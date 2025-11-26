import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import Redlock, { ExecutionError } from 'redlock';

/**
 * Redis 서비스
 * 레디스 클라이언트는 세션용(main.ts), 캐싱용(RedisService), 분산락용(RedisService) 총 3개 클라이언트로 구성
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly LOCK_KEY_PREFIX = 'lock:';

  // Redis 일반 클라이언트(캐싱), RedLock 클라이언트(분산 락)
  private client: Redis;
  private redlock: Redlock;

  // 모듈 초기화
  async onModuleInit(): Promise<void> {
    this.client = new Redis(process.env.REDIS_URL as string);
    this.client.on('error', (err) => this.logger.error('Redis error', err));

    // Redlock 인스턴스 초기화
    if (!this.redlock) {
      this.redlock = new Redlock([this.client] as any, {
        retryCount: 50, // 락 획득 실패시 최대 재시도 횟수
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
   * @param key 락 대상 리소스 식별자 (예: '123')
   * @param fn 락 획득 후 실행할 함수
   * @param options 락 옵션
   * @param options.ttl 락 TTL (기본값: 5000ms)
   * @param options.channel 락 채널/네임스페이스 (예: 'coupon', 'order')
   *                        - Pub/Sub 전환 시 채널별 구독에 활용
   *                        - 락 키: lock:{channel}:{key}
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options?: { ttl?: number; channel?: string },
  ): Promise<T> {
    const { ttl = 5000, channel } = options ?? {};
    const lockKey = this.LOCK_KEY_PREFIX + key;
    const channelKey = this.LOCK_KEY_PREFIX + `${channel}:` + key;

    return await this.redlock.using([lockKey], ttl, async (signal) => {
      if (signal.aborted) {
        throw new Error(`Lock expired for key: ${lockKey}`);
      }
      return await fn();
    });
  }
}
