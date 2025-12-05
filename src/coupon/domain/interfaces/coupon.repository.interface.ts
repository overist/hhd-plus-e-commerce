import { Coupon } from '@/coupon/domain/entities/coupon.entity';
import { UserCoupon } from '@/coupon/domain/entities/user-coupon.entity';

/**
 * Coupon Repository Port
 * 쿠폰 데이터 접근 계약
 */
export abstract class ICouponRepository {
  abstract findById(id: number): Promise<Coupon | null>;
  abstract findManyByIds(ids: number[]): Promise<Coupon[]>;
  abstract findAll(): Promise<Coupon[]>;
  abstract create(coupon: Coupon): Promise<Coupon>;
  abstract update(coupon: Coupon): Promise<Coupon>;
}

/**
 * UserCoupon Repository Port
 * 사용자 쿠폰 데이터 접근 계약
 */
export abstract class IUserCouponRepository {
  abstract findById(id: number): Promise<UserCoupon | null>;
  abstract findByUserId(userId: number): Promise<UserCoupon[]>;
  abstract findByUserCoupon(
    userId: number,
    couponId: number,
  ): Promise<UserCoupon | null>;
  abstract create(userCoupon: UserCoupon): Promise<UserCoupon>;
  abstract update(userCoupon: UserCoupon): Promise<UserCoupon>;
  abstract deleteByOrderId(orderId: number): Promise<void>;
}
