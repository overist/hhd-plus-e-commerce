import { ErrorCode } from '@domain/common/constants/error-code';
import {
  DomainException,
  ValidationException,
} from '@domain/common/exceptions/domain.exception';
import { OrderStatus } from './order-status.vo';

/**
 * Order Entity
 * 주문 정보
 */
export class Order {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public couponId: number | null,
    public totalAmount: number,
    public discountAmount: number,
    public finalAmount: number,
    public status: OrderStatus,
    public readonly createdAt: Date,
    public paidAt: Date | null,
    public readonly expiredAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {
    this.validateAmounts();
    this.validateExpiredAt();
  }

  private validateAmounts(): void {
    if (this.totalAmount < 0) {
      throw new ValidationException(ErrorCode.INVALID_AMOUNT);
    }
    if (this.discountAmount < 0) {
      throw new ValidationException(ErrorCode.INVALID_AMOUNT);
    }
    if (this.finalAmount < 0) {
      throw new ValidationException(ErrorCode.INVALID_AMOUNT);
    }
    if (this.totalAmount - this.discountAmount !== this.finalAmount) {
      throw new ValidationException(ErrorCode.INVALID_AMOUNT);
    }
  }

  private validateExpiredAt(): void {
    if (this.expiredAt <= this.createdAt) {
      throw new ValidationException(ErrorCode.INVALID_ARGUMENT);
    }
  }

  /**
   * ANCHOR 사용자 소유 검증
   */
  validateOwnedBy(userId: number): void {
    if (this.userId !== userId) {
      throw new DomainException(ErrorCode.UNAUTHORIZED);
    }
  }

  /**
   * ANCHOR 주문 만료 여부 확인
   */
  isExpired(): boolean {
    return new Date() > this.expiredAt;
  }

  /**
   * ANCHOR 결제 가능 여부 확인
   */
  canPay(): boolean {
    if (!this.status.isPending()) {
      return false;
    }
    if (this.isExpired()) {
      return false;
    }
    return true;
  }

  /**
   * ANCHOR 결제 처리
   */
  pay(): void {
    if (!this.canPay()) {
      if (this.status.isPaid()) {
        throw new DomainException(ErrorCode.ALREADY_PAID);
      }
      if (this.isExpired()) {
        throw new DomainException(ErrorCode.ORDER_EXPIRED);
      }
      throw new DomainException(ErrorCode.PAYMENT_FAILED);
    }

    this.status = OrderStatus.PAID;
    this.paidAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * ANCHOR 쿠폰 적용
   */
  applyCoupon(couponId: number, discountAmount: number): void {
    if (discountAmount < 0) {
      throw new ValidationException(ErrorCode.INVALID_AMOUNT);
    }
    if (discountAmount > this.totalAmount) {
      throw new ValidationException(ErrorCode.INVALID_AMOUNT);
    }

    this.couponId = couponId;
    this.discountAmount = discountAmount;
    this.finalAmount = this.totalAmount - discountAmount;
    this.updatedAt = new Date();
  }

  /**
   * ANCHOR 주문 만료 처리
   */
  expire(): void {
    if (!this.status.isPending()) {
      throw new DomainException(ErrorCode.INVALID_ORDER_STATUS);
    }
    if (!this.isExpired()) {
      throw new DomainException(ErrorCode.INVALID_ORDER_STATUS);
    }

    this.status = OrderStatus.EXPIRED;
    this.updatedAt = new Date();
  }

  /**
   * ANCHOR 사용자 소유 여부 확인
   */
  isOwnedBy(userId: number): boolean {
    return this.userId === userId;
  }

  /**
   * ANCHOR 결제 취소 (보상 트랜잭션용)
   * 결제 실패 시 주문 상태를 PENDING으로 되돌림
   */
  cancelPayment(): void {
    if (!this.status.isPaid()) {
      throw new DomainException(ErrorCode.INVALID_ORDER_STATUS);
    }

    this.status = OrderStatus.PENDING;
    this.paidAt = null;
    this.updatedAt = new Date();
  }
}
