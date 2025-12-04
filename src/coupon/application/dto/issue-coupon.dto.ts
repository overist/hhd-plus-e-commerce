import { Coupon } from '@/coupon/domain/entities/coupon.entity';
import { UserCoupon } from '@/coupon/domain/entities/user-coupon.entity';
import { CouponIssueResult } from '@/coupon/infrastructure/coupon.redis.service';

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

  /**
   * Redis 캐시 발급 결과로부터 생성
   * Redis에서는 userCouponId가 없으므로 0으로 설정
   */
  static fromRedisResult(
    result: CouponIssueResult,
    coupon: Coupon,
  ): IssueCouponResult {
    const dto = new IssueCouponResult();
    dto.userCouponId = 0; // Redis에서는 ID 없음
    dto.couponName = coupon.name;
    dto.discountRate = coupon.discountRate;
    dto.expiredAt = result.userCoupon?.expiredAt ?? coupon.expiredAt;
    return dto;
  }
}
