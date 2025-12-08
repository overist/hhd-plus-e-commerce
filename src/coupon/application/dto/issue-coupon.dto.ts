import { Coupon } from '@/coupon/domain/entities/coupon.entity';
import { UserCoupon } from '@/coupon/domain/entities/user-coupon.entity';

/**
 * 애플리케이션 레이어 DTO: IssueCoupon 요청
 */
export class IssueCouponCommand {
  userId: number;
  couponId: number;
}

/**
 * 애플리케이션 레이어 DTO: IssueCoupon 응답
 */
export class IssueCouponResult {
  userCouponId: number;
  couponName: string;
  discountRate: number;
  expiredAt: Date;

  static fromDomain(userCoupon: UserCoupon, coupon: Coupon): IssueCouponResult {
    const dto = new IssueCouponResult();
    dto.userCouponId = userCoupon.id;
    dto.couponName = coupon.name;
    dto.discountRate = coupon.discountRate;
    dto.expiredAt = coupon.expiredAt;
    return dto;
  }
}
