import { ExecutionContext, Injectable } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { CACHE_KEY_METADATA } from '@nestjs/cache-manager';

/**
 * HTTP Cache Interceptor
 * 쿼리스트링을 포함한 캐시 키를 생성하는 커스텀 캐시 인터셉터
 *
 * @example
 * // Controller에서 사용
 * @Get('top')
 * @UseInterceptors(HttpCacheInterceptor)
 * @CacheKey('top_products')
 * @CacheTTL(600000) // 10분 (밀리초)
 * async getTopProducts() { ... }
 */
@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  /**
   * 캐시 키 생성
   * @CacheKey 데코레이터가 있으면 해당 키 + 쿼리스트링으로 캐시 키 생성
   * 없으면 기본 CacheInterceptor의 trackBy 사용
   */
  trackBy(context: ExecutionContext): string | undefined {
    const cacheKey = this.reflector.get(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );

    if (cacheKey) {
      const request = context.switchToHttp().getRequest();
      const query = request._parsedUrl?.query;

      // 쿼리스트링이 있으면 캐시 키에 포함
      return query ? `${cacheKey}?${query}` : cacheKey;
    }

    return super.trackBy(context);
  }
}
