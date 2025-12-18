// core
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

// event
import { OrderPaymentEvent } from '@/order/application/events/order-payment.event';
import { OrderPaymentFailEvent } from '@/order/application/events/order-payment-fail.event';
import { OrderPaymentSuccessEvent } from '@/order/application/events/order-payment-success.event';

// service
import { UserDomainService } from '@/user/domain/services/user.service';

/**
 * onOrderPayment - 주문 결제 완료 시 잔액 차감
 *
 * 수신: order.payment
 * 발행: order.payment.success (성공 시)
 *       order.payment.fail (실패 시)
 */
@Injectable()
export class OnOrderPaymentListener {
  constructor(
    private readonly userService: UserDomainService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  private readonly logger = new Logger('user:' + OnOrderPaymentListener.name);

  @OnEvent(OrderPaymentEvent.EVENT_NAME)
  async handleUserBalanceDeductByOrder(
    event: OrderPaymentEvent,
  ): Promise<void> {
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

      this.eventEmitter.emit(
        OrderPaymentSuccessEvent.EVENT_NAME,
        new OrderPaymentSuccessEvent(
          event.orderId,
          userId,
          event.couponId,
          order,
          event.orderItems,
        ),
      );
    } catch (error) {
      this.logger.warn(
        `[onOrderPayment] 잔액 차감 실패 - orderId: ${order.id}, userId: ${userId}, reason: ${error.message}`,
      );

      // order.payment.fail 이벤트 발행 (보상 트랜잭션 트리거)
      this.eventEmitter.emit(
        OrderPaymentFailEvent.EVENT_NAME,
        new OrderPaymentFailEvent(
          event.orderId,
          userId,
          event.couponId,
          order,
          event.orderItems,
          'UserBalanceDeductByOrder',
          error as Error,
        ),
      );
    }
  }
}
