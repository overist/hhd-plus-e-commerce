import { ErrorCode } from '@domain/common/constants/error-code';
import {
  DomainException,
  ValidationException,
} from '@domain/common/exceptions';
import { Coupon } from './coupon.entity';

/**
 * UserCoupon Entity
 * 사용자별 발급된 쿠폰
 */
export class UserCoupon {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly couponId: number,
    public orderId: number | null,
    public readonly createdAt: Date,
    public usedAt: Date | null,
    public readonly expiredAt: Date,
    public updatedAt: Date,
  ) {}

  /**
   * UserCoupon 발급 (정적 팩토리 메서드)
   * BR-006: 하나의 쿠폰은 사용자당 1회만 발급 가능하다
   */
  static issue(userId: number, coupon: Coupon): UserCoupon {
    if (!coupon.canIssue()) {
      if (coupon.isExpired()) {
        throw new DomainException(ErrorCode.EXPIRED_COUPON);
      }
      throw new DomainException(ErrorCode.COUPON_SOLD_OUT);
    }

    return new UserCoupon(
      0, // DB에서 생성
      userId,
      coupon.id,
      null,
      new Date(),
      null,
      coupon.expiredAt,
      new Date(),
    );
  }

  /**
   * 쿠폰 사용 가능 여부 확인
   * BR-007: 발급된 쿠폰은 지정된 만료일까지만 사용 가능하다
   * BR-008: 사용된 쿠폰은 재사용할 수 없다
   */
  canUse(): boolean {
    // 이미 사용된 쿠폰
    if (this.isUsed()) {
      return false;
    }

    // 만료된 쿠폰
    if (this.isExpired()) {
      return false;
    }

    return true;
  }

  /**
   * 쿠폰 사용 여부 확인
   */
  isUsed(): boolean {
    return this.usedAt !== null;
  }

  /**
   * 쿠폰 만료 여부 확인
   */
  isExpired(): boolean {
    return new Date() > this.expiredAt;
  }

  /**
   * 쿠폰 사용 처리
   * BR-008: 사용된 쿠폰은 재사용할 수 없다
   * BR-009: 한 번의 주문에 하나의 쿠폰만 사용 가능하다
   */
  use(orderId: number): void {
    if (!this.canUse()) {
      if (this.isUsed()) {
        throw new DomainException(ErrorCode.ALREADY_USED);
      }
      if (this.isExpired()) {
        throw new DomainException(ErrorCode.EXPIRED_COUPON);
      }
      throw new DomainException(ErrorCode.INVALID_COUPON);
    }

    this.orderId = orderId;
    this.usedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * 쿠폰 상태 조회
   */
  getStatus(): 'AVAILABLE' | 'USED' | 'EXPIRED' {
    if (this.isUsed()) {
      return 'USED';
    }
    if (this.isExpired()) {
      return 'EXPIRED';
    }
    return 'AVAILABLE';
  }

  /**
   * 쿠폰 사용 취소 (보상 트랜잭션용)
   * 결제 실패 시 쿠폰 사용을 되돌림
   */
  cancelUse(): void {
    if (!this.isUsed()) {
      throw new DomainException(ErrorCode.INVALID_COUPON);
    }

    this.orderId = null;
    this.usedAt = null;
    this.updatedAt = new Date();
  }
}
