// CART FACADE

import { Coupon } from '@/coupon/domain/entities/coupon.entity';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/prisma-manager/prisma.service';

export interface UserCouponView {
  userCouponId: number;
  couponName: string;
  discountRate: number;
  expiredAt: Date;
}

@Injectable()
export class CouponFacade {
  constructor(
    private readonly couponService: CouponDomainService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * ANCHOR 장바구니-상품옵션 조회 뷰 반환
   *
   * ✅ [성능 최적화 완료] N+1 쿼리 문제 해결
   * 개선 사항:
   * - IN 절을 활용한 일괄 조회로 변경
   * - 쿼리 횟수: O(n) → O(1)로 개선
   * - 보유 쿠폰 50개 기준: 51번 쿼리 → 2번 쿼리 (96% 감소)
   */
  async getUserCoupons(userId: number): Promise<UserCouponView[]> {
    // 사용자 쿠폰 조회
    const userCoupons = await this.couponService.getUserCoupons(userId);

    if (userCoupons.length === 0) {
      return [];
    }

    const couponIds = [...new Set(userCoupons.map((uc) => uc.couponId))];

    // ✅ N번 쿼리 → 1번 쿼리로 개선 (IN 절 활용)
    const coupons = await this.couponService.getCouponsByIds(couponIds);

    const couponMap = new Map<number, Coupon>();
    coupons.forEach((coupon) => couponMap.set(coupon.id, coupon));

    return userCoupons.map((uc) => ({
      userCouponId: uc.id,
      couponName: couponMap.get(uc.couponId)!.name,
      discountRate: couponMap.get(uc.couponId)!.discountRate,
      expiredAt: couponMap.get(uc.couponId)!.expiredAt,
    }));
  }

  /**
   * ANCHOR 쿠폰 발급
   * @param userId
   * @param coupon
   */
  async issueCoupon(userId: number, couponId: number): Promise<UserCouponView> {
    return await this.prisma.runInTransaction(async () => {
      const coupon = await this.couponService.getCoupon(couponId);
      const issuedCoupon = await this.couponService.issueCouponToUser(
        userId,
        coupon,
      );

      return {
        userCouponId: issuedCoupon.id,
        couponName: coupon.name,
        discountRate: coupon.discountRate,
        expiredAt: coupon.expiredAt,
      };
    });
  }
}
