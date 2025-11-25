import { Order } from '@/order/domain/entities/order.entity';
import { OrderItem } from '@/order/domain/entities/order-item.entity';

/**
 * 주문 항목 입력 데이터
 */
export class OrderItemInput {
  productOptionId: number;
  quantity: number;
}

/**
 * 애플리케이션 레이어 DTO: CreateOrder 요청
 */
export class CreateOrderCommand {
  userId: number;
  items: OrderItemInput[];
}

/**
 * 주문 항목 결과
 */
export class OrderItemResult {
  orderItemId: number;
  productOptionId: number;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;

  static fromDomain(item: OrderItem): OrderItemResult {
    const result = new OrderItemResult();
    result.orderItemId = item.id;
    result.productOptionId = item.productOptionId;
    result.productName = item.productName;
    result.price = item.price;
    result.quantity = item.quantity;
    result.subtotal = item.subtotal;
    return result;
  }
}

/**
 * 애플리케이션 레이어 DTO: CreateOrder 응답
 */
export class CreateOrderResult {
  orderId: number;
  userId: number;
  items: OrderItemResult[];
  totalAmount: number;
  status: string;
  createdAt: Date;
  expiresAt: Date;

  static fromDomain(order: Order, orderItems: OrderItem[]): CreateOrderResult {
    const result = new CreateOrderResult();
    result.orderId = order.id;
    result.userId = order.userId;
    result.items = orderItems.map((item) => OrderItemResult.fromDomain(item));
    result.totalAmount = order.totalAmount;
    result.status = order.status.value;
    result.createdAt = order.createdAt;
    result.expiresAt = order.expiredAt;
    return result;
  }
}
