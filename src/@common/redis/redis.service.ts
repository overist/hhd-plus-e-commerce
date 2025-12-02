import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis 클라이언트 서비스
 * 범용 Redis 클라이언트를 제공합니다.
 *
 * 사용 용도:
 * - 세션 저장소 (express-session)
 * - NoSQL 데이터 조회/저장/삭제
 * - 기타 범용 Redis 작업
 *
 * 참고: 캐시와 분산락은 별도의 전용 모듈 사용
 * - 캐시: GlobalCacheModule (cache-manager)
 * - 분산락: GlobalRedisLockModule (Redlock + PUB/SUB)
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL as string;

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL is not set. Redis client will not be initialized.',
      );
      return;
    }

    this.client = new Redis(redisUrl);
    this.client.on('error', (err) =>
      this.logger.error('Redis client error', err),
    );
    this.client.on('connect', () => this.logger.log('Redis client connected'));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }

  /**
   * Redis 클라이언트 인스턴스 반환
   * 외부에서 직접 Redis 명령어를 사용해야 할 때 사용
   */
  getClient(): Redis {
    return this.client;
  }
}
