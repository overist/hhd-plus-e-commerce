import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Redis 모듈
 * Redis 클라이언트 및 PUB/SUB 기반 분산락 서비스를 제공합니다.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class GlobalRedisModule {}
