import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import Redlock, { ExecutionError } from 'redlock';

/**
 * Redis 서비스
 * 레디스 커넥션은 세션용(main.ts) 1개,
 * cache/lock용(this.client), 1개,
 * lock용 publish/subscribe 2개,
 * 총 4개 클라이언트로 구성
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly LOCK_KEY_PREFIX = 'lock:';
  private readonly LOCK_CHANNEL_PREFIX = 'lock:release:';

  // Redis 일반 클라이언트(캐싱), RedLock 클라이언트(분산 락)
  private client: Redis;
  private publisher: Redis;
  private subscriber: Redis;
  private redlock: Redlock;
  private readonly eventEmitter = new EventEmitter();
  private readonly subscribedChannels = new Set<string>();

  constructor() {
    this.eventEmitter.setMaxListeners(0); // allow many concurrent waiters per channel
  }

  // 모듈 초기화
  async onModuleInit(): Promise<void> {
    this.client = new Redis(process.env.REDIS_URL as string);
    this.client.on('error', (err) => this.logger.error('Redis error', err));

    this.publisher = new Redis(process.env.REDIS_URL as string);
    this.publisher.on('error', (err) =>
      this.logger.error('Redis publish error', err),
    );

    this.subscriber = new Redis(process.env.REDIS_URL as string);
    this.subscriber.on('error', (err) =>
      this.logger.error('Redis subscribe error', err),
    );
    this.subscriber.on('message', (channel) => {
      this.eventEmitter.emit(channel);
    });

    // Redlock 인스턴스 초기화
    if (!this.redlock) {
      this.redlock = new Redlock([this.client] as any, {
        retryCount: 0, // 락 획득 실패시 최대 재시도 횟수 (PUB/SUB 활용시 불필요)
        retryDelay: 100, // 기준 재시도 간격 (ms)
        retryJitter: 50, // 기준 재시도 간격 +- (ms)
        driftFactor: 0.01, // TTL 대비 드리프트 비율
        automaticExtensionThreshold: 500, // API 처리 지연시 자동 연장 임계값 (ms)
      });

      this.redlock.on('clientError', (error) => {
        if (!(error instanceof ExecutionError)) {
          this.logger.error('Redlock error', error);
        }
      });
    }
  }

  // 모듈 종료
  async onModuleDestroy(): Promise<void> {
    await this.redlock?.quit();
    await this.publisher?.quit();
    await this.subscriber?.quit();
    await this.client?.quit();
  }

  // Redis 클라이언트 반환 (캐싱 등에서 사용)
  getClient(): Redis {
    return this.client;
  }
  getRedlock(): Redlock {
    return this.redlock;
  }

  /**
   * Redlock을 이용한 분산 락 처리
   * @param key 락 대상 리소스 식별자 (예: 'coupon:issue:1')
   *            - 락 키: lock:{key}
   *            - 이벤트 채널: lock:release:{key}
   * @param fn 락 획득 후 실행할 함수
   * @param options 락 옵션
   * @param options.ttl 락 TTL (기본값: 5000ms)
   * @param options.waitTimeout 분산락 해제 이벤트 대기 타임아웃 (기본값: ttl)
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options?: { ttl?: number; waitTimeout?: number },
  ): Promise<T> {
    const { ttl = 5000, waitTimeout = ttl } = options ?? {};
    const lockKey = `${this.LOCK_KEY_PREFIX}${key}`;
    const channelName = `${this.LOCK_CHANNEL_PREFIX}${key}`;

    this.logger.debug(`[LOCK] 🔒 Attempting to acquire lock: ${lockKey}`);

    while (true) {
      try {
        return await this.executeWithRedlock(lockKey, channelName, ttl, fn);
      } catch (error) {
        if (!(error instanceof ExecutionError)) {
          throw error;
        }

        this.logger.debug(
          `[LOCK] ⏳ Lock busy, waiting for release: ${lockKey}`,
        );
        await this.waitForUnlock(channelName, waitTimeout);
      }
    }
  }

  private async executeWithRedlock<T>(
    lockKey: string,
    channelName: string,
    ttl: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    let acquired = false;

    try {
      const result = await this.redlock.using(
        [lockKey],
        ttl,
        async (signal) => {
          if (signal.aborted) {
            throw new Error(`Lock expired for key: ${lockKey}`);
          }
          acquired = true; // callback이 실행되었다는 것은 락을 획득했다는 의미
          this.logger.debug(`[LOCK] ✅ Lock acquired: ${lockKey}`);
          return await fn();
        },
      );

      return result;
    } finally {
      if (acquired && channelName) {
        await this.notifyLockRelease(channelName);
      }
    }
  }

  private async notifyLockRelease(channelName: string): Promise<void> {
    this.eventEmitter.emit(channelName);

    this.logger.debug(`[LOCK] 🔓 Lock released, publishing to: ${channelName}`);

    if (!this.publisher) {
      return;
    }

    const payload = JSON.stringify({
      channel: channelName,
      releasedAt: Date.now(),
    });
    try {
      await this.publisher.publish(channelName, payload);
    } catch (error) {
      this.logger.error(
        `Failed to publish lock release for ${channelName}`,
        error,
      );
    }
  }

  private async waitForUnlock(
    channelName: string,
    waitTimeout: number,
  ): Promise<void> {
    await this.ensureChannelSubscription(channelName);

    await new Promise<void>((resolve) => {
      const handler = () => {
        cleanup();
        resolve();
      };

      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, waitTimeout);

      const cleanup = () => {
        clearTimeout(timer);
        this.eventEmitter.off(channelName, handler);
      };

      this.eventEmitter.once(channelName, handler);
    });
  }

  private async ensureChannelSubscription(channelName: string): Promise<void> {
    if (!this.subscriber || this.subscribedChannels.has(channelName)) {
      return;
    }

    try {
      await this.subscriber.subscribe(channelName);
      this.subscribedChannels.add(channelName);
    } catch (error) {
      this.logger.error(`Failed to subscribe channel ${channelName}`, error);
    }
  }
}
