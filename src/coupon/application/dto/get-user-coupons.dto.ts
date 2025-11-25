import { Coupon } from '@/coupon/domain/entities/coupon.entity';
import { UserCoupon } from '@/coupon/domain/entities/user-coupon.entity';

/**
 * 애플리케이션 레이어 DTO: GetUserCoupons 요청
 */
export class GetUserCouponsQuery {
  userId: number;
}

/**
 * 애플리케이션 레이어 DTO: GetUserCoupons 응답
 */
export class GetUserCouponsResult {
  userCouponId: number;
  couponName: string;
  discountRate: number;
  expiredAt: Date;

  static fromDomain(
    userCoupon: UserCoupon,
    coupon: Coupon,
  ): GetUserCouponsResult {
    const dto = new GetUserCouponsResult();
    dto.userCouponId = userCoupon.id;
    dto.couponName = coupon.name;
    dto.discountRate = coupon.discountRate;
    dto.expiredAt = coupon.expiredAt;
    return dto;
  }
}
