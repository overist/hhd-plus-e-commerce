import { ErrorCode, DomainException } from '@common/exception';

/**
 * Product Entity
 */
export class Product {
  constructor(
    public readonly id: number,
    public name: string,
    public description: string,
    public price: number,
    public category: string,
    public isAvailable: boolean,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {
    this.validatePrice();
  }

  /**
   * ANCHOR 가격 검증
   */
  private validatePrice(): void {
    if (this.price < 0) {
      throw new DomainException(ErrorCode.INVALID_PRICE);
    }
  }

  /**
   * ANCHOR 판매 가능 여부 확인
   * 상품이 판매 가능 상태인지 확인 (옵션 재고와 별개)
   */
  validateAvailability(): void {
    if (!this.isAvailable) {
      throw new DomainException(ErrorCode.PRODUCT_UNAVAILABLE);
    }
  }

  /**
   * ANCHOR 상품 판매 중지
   */
  markAsUnavailable(): void {
    this.isAvailable = false;
    this.updatedAt = new Date();
  }

  /**
   * ANCHOR 상품 판매 재개
   */
  markAsAvailable(): void {
    this.isAvailable = true;
    this.updatedAt = new Date();
  }

  // static create(
  //   name: string,
  //   description: string,
  //   price: number,
  //   category: string,
  //   isAvailable: boolean,
  // ): Product {
  //   const now = new Date();
  //   return new Product(
  //     0,
  //     name,
  //     description,
  //     price,
  //     category,
  //     isAvailable,
  //     now,
  //     now,
  //   );
  // }
}
