import { Order } from '@/order/domain/entities/order.entity';
import { User } from '@/user/domain/entities/user.entity';

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
  paidAmount: number;
  remainingBalance: number;
  paidAt: Date;

  static from(order: Order, user: User): ProcessPaymentResult {
    const result = new ProcessPaymentResult();
    result.orderId = order.id;
    result.status = order.status.value;
    result.paidAmount = order.finalAmount;
    result.remainingBalance = user.balance;
    result.paidAt = new Date();
    return result;
  }
}
