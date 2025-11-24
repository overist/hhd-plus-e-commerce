import { Injectable } from '@nestjs/common';
import { ErrorCode, ValidationException } from '@common/exception';
import { ICartRepository } from '../interfaces/cart.repository.interface';
import { CartItem } from '../entities/cart-item.entity';

/**
 * CartDomainService
 * 장바구니 관련 영속성 계층과 상호작용하며 핵심 비즈니스 로직을 담당한다.
 */
@Injectable()
export class CartDomainService {
  constructor(private readonly cartRepository: ICartRepository) {}

  /**
   * ANCHOR 장바구니 항목 추가 또는 수량 증가
   */
  async addCart(
    userId: number,
    productOptionId: number,
    quantity: number,
  ): Promise<void> {
    // variables
    const existingItems = await this.cartRepository.findManyByUserId(userId);
    const existingItem = existingItems.find(
      (item) => item.productOptionId === productOptionId,
    );

    // process
    if (existingItem) {
      existingItem.updateQuantity(existingItem.quantity + quantity);
      await this.cartRepository.update(existingItem); // save
    } else {
      await this.cartRepository.create(userId, productOptionId, quantity); // save
    }
  }

  /**
   * ANCHOR 장바구니 항목 삭제 또는 수량 감소
   */
  async removeCart(userId: number, productOptionId: number): Promise<void> {
    // variables
    const items = await this.cartRepository.findManyByUserId(userId);
    const item = items.find((item) => item.productOptionId === productOptionId);

    // validate
    if (!item) {
      throw new ValidationException(ErrorCode.CART_ITEM_NOT_FOUND);
    }
    item.validateUserId(userId);

    if (item.quantity > 1) {
      // process
      item.updateQuantity(item.quantity - 1);
      await this.cartRepository.update(item); // save
    } else {
      // save
      await this.cartRepository.deleteByUserCart(userId, productOptionId);
    }
  }

  /**
   * ANCHOR 장바구니 조회
   */
  async getCart(userId: number): Promise<CartItem[]> {
    // variables
    const cartItems = await this.cartRepository.findManyByUserId(userId);
    return cartItems;
  }
}
