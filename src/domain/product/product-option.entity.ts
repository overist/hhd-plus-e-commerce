import { ErrorCode } from '@domain/common/constants/error-code';
import {
  DomainException,
  ValidationException,
} from '@domain/common/exceptions/domain.exception';

/**
 * ProductOption Entity
 */
export class ProductOption {
  constructor(
    public readonly id: number,
    public readonly productId: number,
    public color: string | null,
    public size: string | null,
    public stock: number,
    public reservedStock: number,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {
    this.validateStock();
  }

  // static create(
  //   productId: number,
  //   color: string | null,
  //   size: string | null,
  //   stock: number,
  // ): ProductOption {
  //   const now = new Date();
  //   return new ProductOption(0, productId, color, size, stock, 0, now, now);
  // }

  /**
   * ANCHOR 재고 유효성
   */
  private validateStock(): void {
    if (this.stock < 0 || this.reservedStock < 0) {
      throw new ValidationException(ErrorCode.INVALID_STOCK_QUANTITY);
    }
    if (this.reservedStock > this.stock) {
      throw new ValidationException(ErrorCode.INVALID_STOCK_QUANTITY);
    }
  }

  /**
   * ANCHOR 사용 가능한 재고 조회
   * BR-001: 재고가 0 이하인 상품은 주문할 수 없다
   */
  get availableStock(): number {
    return this.stock - this.reservedStock;
  }

  /**
   * ANCHOR 재고 선점 (주문서 생성 시)
   * BR-002: 주문 가능 수량은 (현재 재고 - 선점된 재고) 기준
   */
  reserveStock(quantity: number): void {
    this.reservedStock += quantity;
    this.validateStock();
  }

  /**
   * ANCHOR 재고 확정 차감 (결제 완료 시)
   * BR-003: 결제 완료 시점에 재고가 확정 차감
   */
  decreaseStock(quantity: number): void {
    this.stock -= quantity;
    this.reservedStock -= quantity;
    this.validateStock();
  }

  /**
   * ANCHOR 선점 재고 해제 (결제 실패/만료 시)
   * BR-004: 결제 실패 또는 주문 취소 시 선점된 재고는 즉시 해제
   */
  releaseReservedStock(quantity: number): void {
    this.reservedStock -= quantity;
    this.validateStock();
  }

  /**
   * ANCHOR 재고 관리자용 재고 조정
   */
  adjustStock(newStock: number): void {
    this.stock = newStock;
    this.validateStock();
  }

  /**
   * ANCHOR 재고 복원 (보상 트랜잭션용)
   * 결제 실패 시 확정 차감된 재고를 선점 상태로 되돌림
   */
  restoreStock(quantity: number): void {
    this.stock += quantity;
    this.reservedStock += quantity;
    this.validateStock();
  }
}
