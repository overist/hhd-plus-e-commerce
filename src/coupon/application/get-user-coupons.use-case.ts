import { Injectable } from '@nestjs/common';
import { CouponRedisService } from '@/coupon/infrastructure/coupon.redis.service';
import {
  GetUserCouponsQuery,
  GetUserCouponsResult,
} from './dto/get-user-coupons.dto';

@Injectable()
export class GetUserCouponsUseCase {
  constructor(private readonly couponRedisService: CouponRedisService) {}

  /**
   * ANCHOR 사용자 보유 쿠폰 조회 뷰 반환
   * Redis 캐시에서 사용자 쿠폰 목록을 조회합니다.
   */
  async execute(query: GetUserCouponsQuery): Promise<GetUserCouponsResult[]> {
    const userCoupons = await this.couponRedisService.getCachedUserCoupons(
      query.userId,
    );

    if (userCoupons.length === 0) {
      return [];
    }

    const results: GetUserCouponsResult[] = [];

    for (const userCoupon of userCoupons) {
      const coupon = await this.couponRedisService.getCachedCoupon(
        userCoupon.couponId,
      );

      if (coupon) {
        results.push(GetUserCouponsResult.fromCache(userCoupon, coupon));
      }
    }

    return results;
  }
}
