import { Order } from '@/order/domain/entities/order.entity';
import { OrderItem } from '@/order/domain/entities/order-item.entity';
import { OrderItemResult } from './create-order.dto';

/**
 * 애플리케이션 레이어 DTO: GetOrderDetail 요청
 */
export class GetOrderDetailQuery {
  orderId: number;
}

/**
 * 애플리케이션 레이어 DTO: GetOrderDetail 응답
 */
export class GetOrderDetailResult {
  orderId: number;
  userId: number;
  items: OrderItemResult[];
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: string;
  createdAt: Date;
  paidAt: Date | null;

  static fromDomain(order: Order, items: OrderItem[]): GetOrderDetailResult {
    const result = new GetOrderDetailResult();
    result.orderId = order.id;
    result.userId = order.userId;
    result.items = items.map((item) => OrderItemResult.fromDomain(item));
    result.totalAmount = order.totalAmount;
    result.discountAmount = order.discountAmount;
    result.finalAmount = order.finalAmount;
    result.status = order.status.value;
    result.createdAt = order.createdAt;
    result.paidAt = order.paidAt;
    return result;
  }
}
