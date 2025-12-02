import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Global Redis Module (범용 Redis 클라이언트)
 *
 * 사용 용도:
 * - 세션 저장소 (express-session)
 * - NoSQL 데이터 조회/저장/삭제
 * - 기타 범용 Redis 작업
 *
 * Redis 모듈 구조:
 * - GlobalRedisModule: 범용 Redis 클라이언트 (이 모듈)
 * - GlobalCacheModule: 캐시 전용 (cache-manager + Keyv)
 * - GlobalRedisLockModule: 분산락 전용 (Redlock + PUB/SUB)
 *
 * 환경변수: REDIS_URL
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class GlobalRedisModule {}
