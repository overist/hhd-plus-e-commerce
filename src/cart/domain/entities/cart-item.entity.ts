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
  validateUserId(userId: number): void {
    if (this.userId !== userId) {
      throw new DomainException(ErrorCode.UNAUTHORIZED);
    }
  }

  // /**
  //  * 생성
  //  */
  // static create(
  //   userId: number,
  //   productOptionId: number,
  //   quantity: number,
  // ): CartItem {
  //   const now = new Date();
  //   return new CartItem(0, userId, productOptionId, quantity, now, now);
  // }

  /**
   * 수량 변경
   * RF-005: 사용자는 장바구니에 상품을 추가할 수 있어야 한다
   */
  updateQuantity(quantity: number): void {
    this.validateQuantity();
    this.quantity = quantity;
    this.updatedAt = new Date();
  }
}
