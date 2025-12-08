import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderPaymentFailEvent } from '../events/order-payment-fail.event';
import { OrderDomainService } from '@/order/domain/services/order.service';

/**
 * 주문 상태 롤백 리스너
 *
 * 수신: order.payment.fail
 * 처리: 주문 상태를 PENDING으로 되돌림
 */
@Injectable()
export class OnOrderFailListener {
  private readonly logger = new Logger('order:' + OnOrderFailListener.name);

  constructor(private readonly orderService: OrderDomainService) {}

  /**
   * order.payment 실패 시 주문 상태 롤백
   * (PAID → PENDING)
   */
  @OnEvent(OrderPaymentFailEvent.EVENT_NAME)
  async handleOrderStatusRollbackOnPaymentFail(
    event: OrderPaymentFailEvent,
  ): Promise<void> {
    const { orderId } = event;

    try {
      this.logger.log(
        `[onOrderPaymentFail] 주문 상태 롤백 시작 - orderId: ${orderId}`,
      );

      const order = await this.orderService.getOrder(orderId);

      // 주문 상태가 PAID인 경우에만 롤백
      if (order.status.isPaid()) {
        order.cancelPayment();
        await this.orderService.updateOrder(order);

        this.logger.log(
          `[onOrderPaymentFail] 주문 상태 롤백 완료 - orderId: ${orderId}, status: ${order.status.value}`,
        );
      } else {
        this.logger.log(
          `[onOrderPaymentFail] 주문 상태 롤백 스킵 (이미 PENDING) - orderId: ${orderId}, status: ${order.status.value}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[onOrderPaymentFail] 주문 상태 롤백 실패 - orderId: ${orderId}`,
        error,
      );
      // 보상 트랜잭션 실패는 로깅 후 별도 처리 필요 (알림, 재시도 큐 등)
    }
  }
}
