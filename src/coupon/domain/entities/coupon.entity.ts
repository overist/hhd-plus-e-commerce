import {
  ErrorCode,
  DomainException,
  ValidationException,
} from '@common/exception';

/**
 * Coupon Entity
 * 쿠폰 정보 (관리자에 의해 수량이 변경될 수 있음)
 */
export class Coupon {
  constructor(
    public readonly id: number,
    public name: string,
    public discountRate: number,
    public totalQuantity: number,
    public issuedQuantity: number,
    public readonly expiredAt: Date,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {
    this.validateDiscountRate();
    this.validateQuantity();
  }

  /**
   * 할인율 검증 (0 < discountRate <= 100)
   */
  private validateDiscountRate(): void {
    if (this.discountRate <= 0 || this.discountRate > 100) {
      throw new ValidationException(ErrorCode.INVALID_DISCOUNT_RATE);
    }
  }

  /**
   * 수량 검증
   */
  private validateQuantity(): void {
    if (this.totalQuantity < 0) {
      throw new ValidationException(ErrorCode.INVALID_ISSUE_QUANTITY);
    }
    if (this.issuedQuantity < 0) {
      throw new ValidationException(ErrorCode.INVALID_ISSUE_QUANTITY);
    }
    if (this.issuedQuantity > this.totalQuantity) {
      throw new ValidationException(ErrorCode.INVALID_ISSUE_QUANTITY);
    }
  }

  /**
   * 쿠폰 발급 가능 여부 확인
   * BR-006: 발급된 쿠폰은 지정된 만료일까지만 사용 가능하다
   * NFR-010: 쿠폰 발급 수량은 정확하게 관리되어야 한다 (Over-issue 방지)
   */
  canIssue(): boolean {
    // 만료일 확인
    if (this.isExpired()) {
      return false;
    }

    // 발급 가능 수량 확인
    return this.issuedQuantity < this.totalQuantity;
  }

  /**
   * 쿠폰 만료 여부 확인
   */
  isExpired(): boolean {
    return new Date() > this.expiredAt;
  }

  /**
   * 쿠폰 발급
   * NFR-006: 동시에 같은 쿠폰을 발급받는 경우 수량 정합성을 보장해야 한다
   */
  issue(): void {
    if (!this.canIssue()) {
      if (this.isExpired()) {
        throw new DomainException(ErrorCode.EXPIRED_COUPON);
      }
      throw new DomainException(ErrorCode.COUPON_SOLD_OUT);
    }

    this.issuedQuantity += 1;
    this.updatedAt = new Date();
  }

  /**
   * 할인 금액 계산
   * BR-010: 쿠폰 할인은 상품 금액의 일정 비율(%)로 적용된다. "할인 금액"은 소숫점 첫 번째 자리에서 버린다.
   */
  calculateDiscount(amount: number): number {
    if (amount < 0) {
      throw new ValidationException(ErrorCode.INVALID_DISCOUNT_RATE);
    }

    const discountAmount = (amount * this.discountRate) / 100; // TODO 넘버링 정책
    return Math.floor(discountAmount);
  }

  /**
   * 남은 발급 가능 수량 조회
   */
  getRemain(): number {
    return Math.max(0, this.totalQuantity - this.issuedQuantity);
  }
}
