import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';

import { OrderPaymentSuccessEvent } from '@/order/application/events/order-payment-success.event';
import { OrderProcessedEvent } from '@/order/application/events/order-processed.event';
import { OrderPaymentFailEvent } from '@/order/application/events/order-payment-fail.event';
import { OrderDomainService } from '@/order/domain/services/order.service';

/**
 * order.payment.success
 * - 주문 결제 완료 처리(PAID)
 * - order.processed 발행
 */
@Injectable()
export class OnOrderPaymentSuccessListener {
  private readonly logger = new Logger(
    'order:' + OnOrderPaymentSuccessListener.name,
  );

  constructor(
    private readonly orderService: OrderDomainService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(OrderPaymentSuccessEvent.EVENT_NAME)
  async handle(event: OrderPaymentSuccessEvent): Promise<void> {
    const { orderId, userId, couponId, orderItems } = event;

    try {
      const order = await this.orderService.getOrder(orderId);
      const items = orderItems.length
        ? orderItems
        : await this.orderService.getOrderItems(orderId);

      // 이미 완료된 경우 스킵
      if (order.status.isPaid()) {
        return;
      }

      // 결제 완료
      order.completePayment();
      await this.orderService.updateOrder(order);

      this.logger.log(
        `[order.payment.success] order.processed 발행 - orderId: ${orderId}`,
      );

      this.eventEmitter.emit(
        OrderProcessedEvent.EVENT_NAME,
        new OrderProcessedEvent(orderId, userId, couponId, order, items),
      );
    } catch (error) {
      this.logger.error(
        `[order.payment.success] 실패 - orderId: ${orderId}`,
        error,
      );

      this.eventEmitter.emit(
        OrderPaymentFailEvent.EVENT_NAME,
        new OrderPaymentFailEvent(
          orderId,
          userId,
          couponId,
          event.order,
          orderItems,
          'OnOrderPaymentSuccess',
          error as Error,
        ),
      );
    }
  }
}
