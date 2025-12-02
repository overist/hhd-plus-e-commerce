import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { Keyv } from 'keyv';
import KeyvRedis from '@keyv/redis';
import { HttpCacheInterceptor } from './http-cache.interceptor';

/**
 * Global Cache Module (캐시 전용)
 * cache-manager + Keyv 기반 캐시 서비스를 제공합니다.
 *
 * Redis 모듈 구조:
 * - GlobalRedisModule: 범용 Redis 클라이언트 (세션, NoSQL 등)
 * - GlobalCacheModule: 캐시 전용 (이 모듈)
 * - GlobalRedisLockModule: 분산락 전용 (Redlock + PUB/SUB)
 *
 * 환경변수: REDIS_URL
 */
@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        const redisUrl = process.env.REDIS_URL;

        // Redis 캐시 사용 (REDIS_URL이 설정된 경우)
        if (redisUrl) {
          const keyvRedis = new KeyvRedis(redisUrl);
          const keyv = new Keyv({ store: keyvRedis, namespace: 'cache' });

          return {
            stores: [keyv],
            ttl: 60 * 1000, // 기본 TTL: 60초 (밀리초)
          };
        }

        // 메모리 캐시 사용 (기본값, 개발 환경)
        return {
          ttl: 60 * 1000, // 기본 TTL: 60초 (밀리초)
          max: 100, // 최대 캐시 항목 수
        };
      },
    }),
  ],
  providers: [HttpCacheInterceptor],
  exports: [CacheModule, HttpCacheInterceptor],
})
export class GlobalCacheModule {}
