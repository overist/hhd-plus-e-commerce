import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpCacheInterceptor } from './http-cache.interceptor';

/**
 * Global Cache Module
 */
@Global()
@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 60 * 1000, // 기본 TTL: 60초 (밀리초 단위)
      max: 100, // 최대 캐시 항목 수
    }),
  ],
  providers: [HttpCacheInterceptor],
  exports: [CacheModule, HttpCacheInterceptor],
})
export class GlobalCacheModule {}
