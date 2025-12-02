import { Global, Module } from '@nestjs/common';
import { RedisLockService } from './redis.lock.service';

/**
 * Global Redis Lock Module (분산락 전용)
 * Redlock + PUB/SUB 기반 분산락 서비스를 제공합니다.
 *
 * Redis 모듈 구조:
 * - GlobalRedisModule: 범용 Redis 클라이언트
 * - GlobalCacheModule: 캐시 전용 (cache-manager + Keyv)
 * - GlobalRedisLockModule: 분산락 전용 (이 모듈)
 *
 * 환경변수: REDIS_URL
 */
@Global()
@Module({
  providers: [RedisLockService],
  exports: [RedisLockService],
})
export class GlobalRedisLockModule {}
