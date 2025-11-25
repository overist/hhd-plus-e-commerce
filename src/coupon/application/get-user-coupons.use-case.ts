import { Injectable } from '@nestjs/common';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import {
  GetUserCouponsQuery,
  GetUserCouponsResult,
} from './dto/get-user-coupons.dto';

@Injectable()
export class GetUserCouponsUseCase {
  constructor(private readonly couponService: CouponDomainService) {}

  /**
   * ANCHOR 사용자 보유 쿠폰 조회 뷰 반환
   *
   */
  async execute(query: GetUserCouponsQuery): Promise<GetUserCouponsResult[]> {
    const userCoupons = await this.couponService.getUserCoupons(query.userId);

    if (userCoupons.length === 0) {
      return [];
    }

    const couponIds = [...new Set(userCoupons.map((uc) => uc.couponId))];

    // ✅ N번 쿼리 → 1번 쿼리로 개선 (IN 절 활용)
    const coupons = await this.couponService.getCouponsByIds(couponIds);
    const couponMap = new Map(coupons.map((c) => [c.id, c]));

    return userCoupons.map((userCoupon) => {
      const coupon = couponMap.get(userCoupon.couponId)!;
      return GetUserCouponsResult.fromDomain(userCoupon, coupon);
    });
  }
}
