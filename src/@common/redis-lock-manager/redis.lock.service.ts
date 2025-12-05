import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { RedisLockWaitTimeoutException } from './redis.lock.exception';

/**
 * Redis Lock 서비스 (분산 락 전용)
 * ioredis + PUB/SUB + Watchdog 기반 분산 락 관리
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
  private readonly MAX_WAIT_TIME = 10000;

  // Redis 분산 락 전용 클라이언트
  private client: Redis;
  private subscriber: Redis;

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

    this.subscriber = new Redis(redisUrl);
    this.subscriber.setMaxListeners(0);
    this.subscriber.on('error', (err) =>
      this.logger.error('Redis Lock subscribe error', err),
    );
    this.subscriber.psubscribe(`${this.LOCK_CHANNEL_PREFIX}*`);
  }

  // 모듈 종료
  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit();
    await this.client?.quit();
  }

  /**
   * 분산 락 처리 (Watchdog으로 TTL 자동 연장)
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
    const channel = `${this.LOCK_CHANNEL_PREFIX}${key}`;
    const token = randomUUID();

    // ttl과 별개로 withLock 최대 대기시간 - 메모리 누수 방지
    const startTime = Date.now();

    while (Date.now() - startTime < this.MAX_WAIT_TIME) {
      // [1] 락 획득 시도
      const acquired = await this.tryAcquire(lockKey, token, ttl);

      if (acquired) {
        // [2] Watchdog 시작 (TTL 자동 연장)
        const watchdog = this.startWatchdog(lockKey, token, ttl);

        try {
          // [3] 비즈니스 로직 수행
          return await fn();
        } finally {
          // [4] Watchdog 종료 및 락 해제
          clearInterval(watchdog);
          await this.release(lockKey, token, channel);
        }
      }

      // 락 획득 실패시 waitTimeout 대기 후 재시도
      // 대기 중 락 해제 이벤트를 수신하면 즉시 해제
      await this.waitForUnlock(channel, waitTimeout);
    }

    // 최대 대기 시간 오버시 요청 실패 (메모리 누수 방지)
    throw new RedisLockWaitTimeoutException(key);
  }

  /** 락 획득 시도 (SET NX) */
  private async tryAcquire(
    key: string,
    token: string,
    ttl: number,
  ): Promise<boolean> {
    const result = await this.client.set(key, token, 'PX', ttl, 'NX');
    return result === 'OK';
  }

  /** Watchdog: TTL의 1/3 주기마다 자동 연장 */
  private startWatchdog(
    key: string,
    token: string,
    ttl: number,
  ): NodeJS.Timeout {
    const extendScript = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('pexpire', KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    return setInterval(async () => {
      await this.client
        .eval(extendScript, 1, key, token, ttl)
        .catch((error) => {
          this.logger.error('Error extending lock TTL', error);
        });
    }, ttl / 3);
  }

  /** 락 해제 및 이벤트 발행 */
  private async release(
    key: string,
    token: string,
    channel: string,
  ): Promise<void> {
    const releaseScript = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        redis.call('del', KEYS[1])
        redis.call('publish', ARGV[2], 'released')
        return 1
      else
        return 0
      end
    `;

    await this.client.eval(releaseScript, 1, key, token, channel).catch((e) => {
      this.logger.error('Error releasing lock', e);
    });
  }

  /** 락 해제 이벤트 대기 */
  private waitForUnlock(channel: string, timeout: number): Promise<void> {
    return new Promise((resolve) => {
      // ** Resolve Case 1: 락 릴리즈 이벤트 수신시 wait 종료
      const done = () => {
        clearTimeout(timer);
        this.subscriber.off('pmessage', handler);
        resolve();
      };

      const handler = (_: string, ch: string) => {
        if (ch === channel) done();
      };

      // ** 이벤트 리스너 등록
      this.subscriber.on('pmessage', handler);

      // ** Resolve Case 2: waitTimeout 도달시 wait 즉시 종료
      const timer = setTimeout(done, timeout);
    });
  }
}
