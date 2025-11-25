import { User } from '@/user/domain/entities/user.entity';

/**
 * 애플리케이션 레이어 DTO: ProcessPayment 요청
 */
export class ProcessPaymentCommand {
  orderId: number;
  userId: number;
  userCouponId?: number;
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

  static fromData(
    orderId: number,
    paidAmount: number,
    user: User,
    paidAt: Date,
  ): ProcessPaymentResult {
    const result = new ProcessPaymentResult();
    result.orderId = orderId;
    result.status = 'PAID';
    result.paidAmount = paidAmount;
    result.remainingBalance = user.balance;
    result.paidAt = paidAt;
    return result;
  }
}
