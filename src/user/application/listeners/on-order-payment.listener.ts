// core
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

// event
import { OrderPaymentEvent } from '@/order/application/events/order-payment.event';

// service
import { UserDomainService } from '@/user/domain/services/user.service';
import { User } from '@/user/domain/entities/user.entity';

/**
 * onOrderPayment - 주문 결제 완료 시 잔액 차감
 *
 * 수신: order.payment
 * 반환: UserBalanceDeductByOrderResult (동기적 응답)
 * 발행: balance.deducted (성공 시)
 *       balance.deducted.failed (실패 시)
 */
@Injectable()
export class OnOrderPaymentListener {
  constructor(
    private readonly userService: UserDomainService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  private readonly logger = new Logger(OnOrderPaymentListener.name);

  @OnEvent(OrderPaymentEvent.EVENT_NAME)
  async handleUserBalanceDeductByOrder(
    event: OrderPaymentEvent,
  ): Promise<UserBalanceDeductByOrderResult> {
    const { order, orderItems, orderId, userId, couponId } = event;

    try {
      this.logger.log(
        `[onOrderPayment] 잔액 차감 시작 - orderId: ${order.id}, userId: ${userId}, amount: ${order.finalAmount}`,
      );

      // 낙관적 잠금을 사용한 잔액 차감
      const user = await this.userService.deductBalance(
        userId,
        order.finalAmount,
        order.id,
        `주문 ${order.id} 결제`,
      );

      this.logger.log(
        `[onOrderPayment] 잔액 차감 성공 - orderId: ${order.id}, userId: ${userId}, remainingBalance: ${user.balance}`,
      );

      return {
        listenerName: 'UserBalanceDeductResult',
        success: true,
        user,
      };
    } catch (error) {
      this.logger.error(
        `[onOrderPayment] 잔액 차감 실패 - orderId: ${order.id}, userId: ${userId}`,
        error,
      );

      return {
        listenerName: 'UserBalanceDeductResult',
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

/**
 * 잔액 차감 결과 (동기적 응답용)
 */
export interface UserBalanceDeductByOrderResult {
  listenerName: 'UserBalanceDeductResult';
  success: boolean;
  error?: Error;
  user?: User;
}
