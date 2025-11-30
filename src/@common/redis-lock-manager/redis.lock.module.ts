import { Global, Module } from '@nestjs/common';
import { RedisLockService } from './redis.lock.service';

/**
 * Redis 모듈
 * Redis 클라이언트 및 PUB/SUB 기반 분산락 서비스를 제공합니다.
 */
@Global()
@Module({
  providers: [RedisLockService],
  exports: [RedisLockService],
})
export class GlobalRedisModule {}
