import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import Redlock, { ExecutionError } from 'redlock';

/**
 * Redis Lock 서비스 (분산 락 전용)
 * Redlock + PUB/SUB 기반 분산 락 관리
 *
 * Redis 모듈 구조:
 * - GlobalRedisModule: 범용 Redis 클라이언트 (세션, NoSQL 등)
 * - GlobalCacheModule: 캐시 전용 (cache-manager + Keyv)
 * - GlobalRedisLockModule: 분산락 전용 (이 서비스)
 *
 * 환경변수: REDIS_URL
 */
@Injectable()
export class RedisLockService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisLockService.name);
  private readonly LOCK_KEY_PREFIX = 'lock:';
  private readonly LOCK_CHANNEL_PREFIX = 'lock:release:';

  // Redis 분산 락 전용 클라이언트
  private client: Redis;
  private publisher: Redis;
  private subscriber: Redis;
  private redlock: Redlock;

  /** getter (통합테스트 전용) */
  getClient(): Redis {
    return this.client;
  }

  // 모듈 초기화
  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL as string;

    this.client = new Redis(redisUrl);
    this.client.on('error', (err) =>
      this.logger.error('Redis Lock client error', err),
    );

    this.publisher = new Redis(redisUrl);
    this.publisher.on('error', (err) =>
      this.logger.error('Redis Lock publish error', err),
    );

    this.subscriber = new Redis(redisUrl);
    this.subscriber.setMaxListeners(0);
    this.subscriber.on('error', (err) =>
      this.logger.error('Redis Lock subscribe error', err),
    );
    this.subscriber.psubscribe(`${this.LOCK_CHANNEL_PREFIX}*`);

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

  /**
   * Redlock을 이용한 분산 락 처리
   * @param key 락 대상 리소스 식별자 (예: 'coupon:issue:1')
   *            - 락 키: lock:{key}
   *            - 이벤트 채널: lock:release:{key}
   * @param fn 락 획득 후 실행할 함수
   * @param options 락 옵션
   * @param options.ttl 락 TTL (기본값: 5000ms)
   * @param options.waitTimeout 분산락 해제 이벤트 대기 타임아웃 (기본값: 1000ms) - 만료시 기다리지 않고 즉시 재시도
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options?: { ttl?: number; waitTimeout?: number },
  ): Promise<T> {
    const { ttl = 5000, waitTimeout = 1000 } = options ?? {};
    const lockKey = `${this.LOCK_KEY_PREFIX}${key}`;
    const channelName = `${this.LOCK_CHANNEL_PREFIX}${key}`;

    this.logger.debug(`[LOCK] 🔒 Attempting to acquire lock: ${lockKey}`);

    // ttl과 별개로 withLock 최대 대기시간 10초 - 메모리 누수 방지
    const startTime = Date.now();
    const maxWaitTime = 10000;
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // [1] 락 획득 -> [2] 로직 수행 -> [3] 락 해제 -> [4] 락해제 이벤트 발행
        return await this.executeWithRedlock(lockKey, channelName, ttl, fn);
      } catch (error) {
        // Redis NX 옵션에 의한 에러가 아닌 경우 에러 전파
        if (!(error instanceof ExecutionError)) {
          throw error;
        }

        // Redis NX에 의한 Execution Error 발생시 waitTimeout 대기 후 재시도
        // 대기 중 락 해제 이벤트를 수신하면 즉시 해제
        await this.waitForUnlock(channelName, waitTimeout);
      }
    }

    // 최대 대기 시간 오버시 요청 실패(메모리 누수 방지)
    throw new Error(
      `Failed to acquire lock within timeout for key: ${lockKey}`,
    );
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
    return await new Promise<void>((resolve) => {
      this.logger.debug(
        `[LOCK] ⏳ Lock busy, waiting for release: ${channelName}`,
      );

      // ** Resolve Case 1 : 락 릴리즈 이벤트 수신시 wait 종료
      const handler = (pattern: string, channel: string) => {
        if (channel !== channelName) return;

        clearTimeout(timer);
        this.subscriber.off('pmessage', handler);
        resolve();
      };

      // ** 이벤트 리스너 등록
      this.subscriber.on('pmessage', handler);

      // ** Resolve Case 2 : waitTimeout 도달시 wait 즉시 종료
      const timer = setTimeout(() => {
        this.subscriber.off('pmessage', handler);
        resolve();
      }, waitTimeout);
    });
  }
}
