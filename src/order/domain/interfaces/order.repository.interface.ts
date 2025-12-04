import { Order } from '@/order/domain/entities/order.entity';
import { OrderItem } from '@/order/domain/entities/order-item.entity';

/**
 * Order Repository Port
 * 주문 데이터 접근 계약
 */
export abstract class IOrderRepository {
  abstract findById(id: number): Promise<Order | null>;
  abstract findManyByUserId(userId: number): Promise<Order[]>;
  abstract create(order: Order): Promise<Order>;
  abstract update(order: Order): Promise<Order>;
}

/**
 * OrderItem Repository Port
 * 주문 상품 데이터 접근 계약
 */
export abstract class IOrderItemRepository {
  abstract findManyByOrderId(orderId: number): Promise<OrderItem[]>;
  abstract create(orderItem: OrderItem): Promise<OrderItem>;
  abstract createMany(orderItems: OrderItem[]): Promise<OrderItem[]>;

  abstract recordSales(orderItems: OrderItem[]): void;
}
