import { ErrorCode, ValidationException } from '@common/exception';

/**
 * OrderItem Entity
 * 주문 상품 상세
 */
export class OrderItem {
  constructor(
    public readonly id: number,
    public readonly orderId: number,
    public readonly productOptionId: number,
    public readonly productName: string,
    public readonly price: number,
    public readonly quantity: number,
    public readonly subtotal: number,
    public readonly createdAt: Date,
  ) {
    this.validatePrice();
    this.validateQuantity();
    this.validateSubtotal();
  }

  private validatePrice(): void {
    if (this.price < 0) {
      throw new ValidationException(ErrorCode.INVALID_PRICE);
    }
  }

  private validateQuantity(): void {
    if (!Number.isInteger(this.quantity) || this.quantity <= 0) {
      throw new ValidationException(ErrorCode.INVALID_QUANTITY);
    }
  }

  private validateSubtotal(): void {
    if (this.subtotal < 0) {
      throw new ValidationException(ErrorCode.INVALID_AMOUNT);
    }
    if (this.price * this.quantity !== this.subtotal) {
      throw new ValidationException(ErrorCode.INVALID_AMOUNT);
    }
  }
}
