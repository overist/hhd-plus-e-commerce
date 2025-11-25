import {
  ErrorCode,
  DomainException,
  ValidationException,
} from '@common/exception';

/**
 * CartItem Entity
 * 장바구니 항목
 */
export class CartItem {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly productOptionId: number,
    public quantity: number,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {
    this.validateQuantity();
  }

  /**
   * 수량 검증
   */
  private validateQuantity(): void {
    if (!Number.isInteger(this.quantity) || this.quantity <= 0) {
      throw new ValidationException(ErrorCode.INVALID_QUANTITY);
    }
  }

  /**
   * 소유 검증
   */
  validateOwnership(userId: number): void {
    if (this.userId !== userId) {
      throw new DomainException(ErrorCode.UNAUTHORIZED);
    }
  }

  /**
   * 수량 증가
   * RF-005: 사용자는 장바구니에 상품을 추가할 수 있어야 한다
   */
  increaseQuantity(amount: number): void {
    if (amount <= 0) {
      throw new ValidationException(ErrorCode.INVALID_QUANTITY);
    }
    this.quantity += amount;
    this.updatedAt = new Date();
  }

  /**
   * 수량 감소
   */
  decreaseQuantity(amount: number = 1): void {
    if (amount <= 0) {
      throw new ValidationException(ErrorCode.INVALID_QUANTITY);
    }
    if (this.quantity - amount < 0) {
      throw new ValidationException(ErrorCode.INVALID_QUANTITY);
    }
    this.quantity -= amount;
    this.updatedAt = new Date();
  }

  /**
   * 삭제 가능 여부 (수량이 1이하인 경우)
   */
  shouldBeRemoved(): boolean {
    return this.quantity <= 1;
  }
}
