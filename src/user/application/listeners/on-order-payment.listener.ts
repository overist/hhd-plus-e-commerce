// core
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

// event
import { OrderPaymentEvent } from '@/order/application/events/order-payment.event';
import { OrderPaymentFailEvent } from '@/order/application/events/order-payment-fail.event';

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
    const { order, userId } = event;

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
        listenerName: 'UserBalanceDeductByOrder',
        user,
      };
    } catch (error) {
      this.logger.error(
        `[onOrderPayment] 잔액 차감 실패 - orderId: ${order.id}, userId: ${userId}`,
        error,
      );

      // order.payment.fail 이벤트 발행 (보상 트랜잭션 트리거) - 동기적으로 완료 대기
      await this.eventEmitter.emitAsync(
        OrderPaymentFailEvent.EVENT_NAME,
        new OrderPaymentFailEvent(
          event.orderId,
          userId,
          event.couponId,
          order,
          event.orderItems,
          'UserBalanceDeductByOrder',
          error,
        ),
      );

      return {
        listenerName: 'UserBalanceDeductByOrder',
        error: error as Error,
      };
    }
  }
}

/**
 * 잔액 차감 결과 (동기적 응답용)
 */
export interface UserBalanceDeductByOrderResult {
  listenerName: 'UserBalanceDeductByOrder';
  user?: User;
  error?: Error;
}
