import { Order } from '@/order/domain/entities/order.entity';

/**
 * 애플리케이션 레이어 DTO: ProcessPayment 요청
 */
export class ProcessPaymentCommand {
  orderId: number;
  userId: number;
  couponId?: number;
}

/**
 * 애플리케이션 레이어 DTO: ProcessPayment 응답
 */
export class ProcessPaymentResult {
  orderId: number;
  status: string;
  requestedAt: Date;

  static from(order: Order): ProcessPaymentResult {
    const result = new ProcessPaymentResult();
    result.orderId = order.id;
    result.status = order.status.value;
    result.requestedAt = new Date();
    return result;
  }
}
