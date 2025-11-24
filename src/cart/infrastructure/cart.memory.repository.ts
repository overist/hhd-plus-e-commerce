import { Injectable } from '@nestjs/common';
import { ICartRepository } from '../domain/interfaces/cart.repository.interface';
import { CartItem } from '../domain/entities/cart-item.entity';

/**
 * Cart Repository Implementation (In-Memory)
 */
@Injectable()
export class CartMemoryRepository implements ICartRepository {
  private cartItems: Map<number, CartItem> = new Map();
  private currentId = 1;

  // ANCHOR findById
  async findById(id: number): Promise<CartItem | null> {
    return this.cartItems.get(id) || null;
  }

  // ANCHOR findManyByUserId
  async findManyByUserId(userId: number): Promise<CartItem[]> {
    return Array.from(this.cartItems.values()).filter(
      (item) => item.userId === userId,
    );
  }

  // ANCHOR create
  async create(
    userId: number,
    productOptionId: number,
    quantity: number,
  ): Promise<CartItem> {
    const newCartItem = new CartItem(
      this.currentId++,
      userId,
      productOptionId,
      quantity,
      new Date(),
      new Date(),
    );
    this.cartItems.set(newCartItem.id, newCartItem);
    return newCartItem;
  }

  // ANCHOR update
  async update(cartItem: CartItem): Promise<CartItem> {
    this.cartItems.set(cartItem.id, cartItem);
    return cartItem;
  }

  // ANCHOR deleteByUserCart
  async deleteByUserCart(
    userId: number,
    productOptionId: number,
  ): Promise<void> {
    for (const [id, item] of this.cartItems) {
      if (item.userId === userId && item.productOptionId === productOptionId) {
        this.cartItems.delete(id);
      }
    }
  }
}
