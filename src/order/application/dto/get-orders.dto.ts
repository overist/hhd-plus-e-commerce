import { Order } from '@/order/domain/entities/order.entity';

/**
 * 애플리케이션 레이어 DTO: GetOrders 요청
 */
export class GetOrdersQuery {
  userId: number;
}

/**
 * 애플리케이션 레이어 DTO: GetOrders 응답 (단일 주문)
 */
export class GetOrdersResult {
  orderId: number;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: string;
  createdAt: Date;
  paidAt: Date | null;

  static fromDomain(order: Order): GetOrdersResult {
    const result = new GetOrdersResult();
    result.orderId = order.id;
    result.totalAmount = order.totalAmount;
    result.discountAmount = order.discountAmount;
    result.finalAmount = order.finalAmount;
    result.status = order.status.value;
    result.createdAt = order.createdAt;
    result.paidAt = order.paidAt;
    return result;
  }
}
