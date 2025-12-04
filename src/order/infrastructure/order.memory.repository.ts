import { Injectable } from '@nestjs/common';
import {
  IOrderItemRepository,
  IOrderRepository,
} from '../domain/interfaces/order.repository.interface';
import { Order } from '../domain/entities/order.entity';
import { OrderItem } from '../domain/entities/order-item.entity';

/**
 * Order Repository Implementation (In-Memory)
 */
@Injectable()
export class OrderMemoryRepository implements IOrderRepository {
  private orders: Map<number, Order> = new Map();
  private currentId = 1;

  // ANCHOR findById
  async findById(id: number): Promise<Order | null> {
    return this.orders.get(id) || null;
  }

  // ANCHOR findManyByUserId
  async findManyByUserId(userId: number): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter((order) => order.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ANCHOR create
  async create(order: Order): Promise<Order> {
    const newOrder = new Order(
      this.currentId++,
      order.userId,
      order.couponId,
      order.totalAmount,
      order.discountAmount,
      order.finalAmount,
      order.status,
      order.createdAt,
      order.paidAt,
      order.expiredAt,
      order.updatedAt,
    );
    this.orders.set(newOrder.id, newOrder);
    return newOrder;
  }

  // ANCHOR update
  async update(order: Order): Promise<Order> {
    this.orders.set(order.id, order);
    return order;
  }
}

/**
 * OrderItem Repository Implementation (In-Memory)
 */
@Injectable()
export class OrderItemRepository implements IOrderItemRepository {
  private orderItems: Map<number, OrderItem> = new Map();
  private currentId = 1;

  // ANCHOR findManyByOrderId
  async findManyByOrderId(orderId: number): Promise<OrderItem[]> {
    return Array.from(this.orderItems.values()).filter(
      (item) => item.orderId === orderId,
    );
  }

  // ANCHOR create
  async create(orderItem: OrderItem): Promise<OrderItem> {
    const newOrderItem = new OrderItem(
      this.currentId++,
      orderItem.orderId,
      orderItem.productOptionId,
      orderItem.productName,
      orderItem.price,
      orderItem.quantity,
      orderItem.subtotal,
      orderItem.createdAt,
    );
    this.orderItems.set(newOrderItem.id, newOrderItem);
    return newOrderItem;
  }

  // ANCHOR createMany
  async createMany(orderItems: OrderItem[]): Promise<OrderItem[]> {
    return Promise.all(orderItems.map((item) => this.create(item)));
  }

  // ANCHOR recordSales
  recordSales(orderItems: OrderItem[]): void {
    // In-memory implementation does not track sales
  }

  // ANCHOR findRankByDate
  async findRankByDate(
    date: string,
  ): Promise<{ productOptionId: number; salesCount: number }[]> {
    // In-memory implementation does not track sales, return empty array
    return [];
  }
}
