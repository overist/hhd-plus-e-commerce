import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { Keyv } from 'keyv';
import KeyvRedis from '@keyv/redis';
import { HttpCacheInterceptor } from './http-cache.interceptor';

/**
 * Global Cache Module (캐시 전용 Redis)
 *
 * Redis 분리 구조:
 * - 세션용 Redis (REDIS_SESSION_URL): main.ts에서 express-session과 함께 사용
 * - 분산락용 Redis (REDIS_LOCK_URL): redis.lock.service.ts에서 Redlock과 함께 사용 (client, publisher, subscriber)
 * - 캐시용 Redis (REDIS_CACHE_URL): 이 모듈에서 cache-manager와 함께 사용
 */
@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        const cacheRedisUrl = process.env.REDIS_CACHE_URL;

        // Redis 캐시 사용 (REDIS_CACHE_URL이 설정된 경우)
        if (cacheRedisUrl) {
          const keyvRedis = new KeyvRedis(cacheRedisUrl);
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
