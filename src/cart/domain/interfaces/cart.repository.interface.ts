import { CartItem } from '@/cart/domain/entities/cart-item.entity';

/**
 * Cart Repository Port
 * 장바구니 데이터 접근 계약
 */
export abstract class ICartRepository {
  abstract findById(id: number): Promise<CartItem | null>;
  abstract findManyByUserId(userId: number): Promise<CartItem[]>;
  abstract findByUserIdAndProductOptionId(
    userId: number,
    productOptionId: number,
  ): Promise<CartItem | null>;
  abstract create(
    userId: number,
    productOptionId: number,
    quantity: number,
  ): Promise<CartItem>;
  abstract update(cartItem: CartItem): Promise<CartItem>;
  abstract delete(id: number): Promise<void>;
}
