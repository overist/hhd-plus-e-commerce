import { Injectable } from '@nestjs/common';
import { cart_items, Prisma } from '@prisma/client';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import { ICartRepository } from '@/cart/domain/interfaces/cart.repository.interface';
import { CartItem } from '@/cart/domain/entities/cart-item.entity';

/**
 * Cart Repository Implementation (Prisma)
 */
@Injectable()
export class CartRepository implements ICartRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get prismaClient(): Prisma.TransactionClient | PrismaService {
    return this.prisma.getClient();
  }

  // ANCHOR findById
  async findById(id: number): Promise<CartItem | null> {
    const record = await this.prismaClient.cart_items.findUnique({
      where: { id: BigInt(id) },
    });
    return record ? this.mapToDomain(record) : null;
  }

  // ANCHOR findManyByUserId
  async findManyByUserId(userId: number): Promise<CartItem[]> {
    const records = await this.prismaClient.cart_items.findMany({
      where: { user_id: userId },
    });
    return records.map((record) => this.mapToDomain(record));
  }

  // ANCHOR findByUserIdAndProductOptionId
  async findByUserIdAndProductOptionId(
    userId: number,
    productOptionId: number,
  ): Promise<CartItem | null> {
    const record = await this.prismaClient.cart_items.findFirst({
      where: {
        user_id: userId,
        product_option_id: productOptionId,
      },
    });
    return record ? this.mapToDomain(record) : null;
  }

  // ANCHOR create
  async create(
    userId: number,
    productOptionId: number,
    quantity: number,
  ): Promise<CartItem> {
    const created = await this.prismaClient.cart_items.create({
      data: {
        user_id: userId,
        product_option_id: productOptionId,
        quantity,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return this.mapToDomain(created);
  }

  // ANCHOR update
  async update(cartItem: CartItem): Promise<CartItem> {
    const updated = await this.prismaClient.cart_items.update({
      where: { id: BigInt(cartItem.id) },
      data: {
        quantity: cartItem.quantity,
        updated_at: cartItem.updatedAt,
      },
    });
    return this.mapToDomain(updated);
  }

  // ANCHOR delete
  async delete(id: number): Promise<void> {
    await this.prismaClient.cart_items.delete({
      where: { id: BigInt(id) },
    });
  }

  /**
   * Helper 도메인 맵퍼
   */
  private mapToDomain(record: cart_items): CartItem {
    return new CartItem(
      Number(record.id),
      record.user_id,
      record.product_option_id,
      record.quantity,
      record.created_at,
      record.updated_at,
    );
  }
}
