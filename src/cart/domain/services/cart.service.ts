import { Injectable } from '@nestjs/common';
import { ErrorCode, DomainException } from '@common/exception';
import { ICartRepository } from '../interfaces/cart.repository.interface';
import { CartItem } from '../entities/cart-item.entity';

/**
 * CartDomainService
 * 장바구니 관련 핵심 비즈니스 로직을 담당한다.
 */
@Injectable()
export class CartDomainService {
  constructor(private readonly cartRepository: ICartRepository) {}

  /**
   * ANCHOR 특정 장바구니 항목 조회
   */
  async getCartItem(
    userId: number,
    productOptionId: number,
  ): Promise<CartItem | null> {
    return this.cartRepository.findByUserIdAndProductOptionId(
      userId,
      productOptionId,
    );
  }

  /**
   * ANCHOR 장바구니 전체 조회
   */
  async getCartItems(userId: number): Promise<CartItem[]> {
    return this.cartRepository.findManyByUserId(userId);
  }

  /**
   * ANCHOR 장바구니 항목 추가 또는 수량 증가
   */
  async addOrIncreaseQuantity(
    userId: number,
    productOptionId: number,
    quantity: number,
  ): Promise<CartItem> {
    const existingItem = await this.getCartItem(userId, productOptionId);

    if (existingItem) {
      existingItem.increaseQuantity(quantity);
      return this.cartRepository.update(existingItem);
    }

    return this.cartRepository.create(userId, productOptionId, quantity);
  }

  /**
   * ANCHOR 장바구니 항목 수량 감소 또는 삭제
   */
  async decreaseQuantityOrRemove(
    userId: number,
    productOptionId: number,
  ): Promise<void> {
    const item = await this.getCartItem(userId, productOptionId);

    if (!item) {
      throw new DomainException(ErrorCode.CART_ITEM_NOT_FOUND);
    }

    item.validateOwnership(userId);

    if (item.shouldBeRemoved()) {
      await this.cartRepository.delete(item.id);
    } else {
      item.decreaseQuantity();
      await this.cartRepository.update(item);
    }
  }
}
