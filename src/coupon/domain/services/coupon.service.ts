import { Injectable } from '@nestjs/common';
import { ErrorCode, DomainException } from '@common/exception';
import { Coupon } from '../entities/coupon.entity';
import { UserCoupon } from '@/coupon/domain/entities/user-coupon.entity';
import {
  ICouponRepository,
  IUserCouponRepository,
} from '@/coupon/domain/interfaces/coupon.repository.interface';

/**
 * CouponDomainService
 * 쿠폰 발급 및 조회에 대한 핵심 규칙을 담당한다.
 */
@Injectable()
export class CouponDomainService {
  constructor(
    private readonly couponRepository: ICouponRepository,
    private readonly userCouponRepository: IUserCouponRepository,
  ) {}

  /**
   * ANCHOR 쿠폰 조회
   */
  async getCoupon(couponId: number): Promise<Coupon> {
    const coupon = await this.couponRepository.findById(couponId);
    if (!coupon) {
      throw new DomainException(ErrorCode.COUPON_NOT_FOUND);
    }
    return coupon;
  }

  /**
   * ANCHOR 쿠폰 일괄 조회
   */
  async getCouponsByIds(couponIds: number[]): Promise<Coupon[]> {
    if (couponIds.length === 0) {
      return [];
    }
    const coupons = await this.couponRepository.findManyByIds(couponIds);
    return coupons;
  }

  /**
   * ANCHOR 사용자 쿠폰 목록 조회
   */
  async getUserCoupons(userId: number): Promise<UserCoupon[]> {
    const userCoupons = await this.userCouponRepository.findByUserId(userId);
    if (!userCoupons) {
      throw new DomainException(ErrorCode.COUPON_INFO_NOT_FOUND);
    }
    return userCoupons;
  }

  /**
   * ANCHOR 사용자 쿠폰 단건 조회
   */
  async getUserCoupon(userCouponId: number): Promise<UserCoupon> {
    const userCoupon = await this.userCouponRepository.findById(userCouponId);
    if (!userCoupon) {
      throw new DomainException(ErrorCode.COUPON_NOT_FOUND);
    }
    return userCoupon;
  }

  /**
   * ANCHOR 사용자 쿠폰 업데이트
   */
  async updateUserCoupon(userCoupon: UserCoupon): Promise<UserCoupon> {
    return await this.userCouponRepository.update(userCoupon);
  }

  /**
   * ANCHOR 주문 ID로 사용자 쿠폰 삭제
   * 보상 트랜잭션에서 사용 (결제 실패 시 DB 쿠폰 기록 삭제)
   */
  async deleteUserCouponByOrderId(orderId: number): Promise<void> {
    await this.userCouponRepository.deleteByOrderId(orderId);
  }

  /**
   * ANCHOR 쿠폰 발급
   */
  async issueCouponToUser(userId: number, coupon: Coupon): Promise<UserCoupon> {
    // 중복 발급 여부 검증
    const already = await this.userCouponRepository.findByUserCoupon(
      userId,
      coupon.id,
    );
    if (already) {
      throw new DomainException(ErrorCode.ALREADY_ISSUED);
    }

    // 쿠폰 발급 가능 여부 확인 (수량 및 만료일)
    coupon.validateIssuable();

    // 쿠폰 발급 처리 (도메인 규칙에 따라 쿠폰 수량 차감)
    coupon.issue();
    await this.couponRepository.update(coupon); // save

    const userCoupon = UserCoupon.issue(userId, coupon);
    const savedUserCoupon = await this.userCouponRepository.create(userCoupon); // save

    return savedUserCoupon;
  }
}
