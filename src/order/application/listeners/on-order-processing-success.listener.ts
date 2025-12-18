import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';

import { OrderProcessingSuccessEvent } from '@/order/application/events/order-processing-success.event';
import { OrderProcessingFailEvent } from '@/order/application/events/order-processing-fail.event';
import { OrderPaymentEvent } from '@/order/application/events/order-payment.event';
import { OrderDomainService } from '@/order/domain/services/order.service';

/**
 * order.processing.success
 * - 쿠폰 할인 금액을 주문에 반영
 * - order.payment 발행
 */
@Injectable()
export class OnOrderProcessingSuccessListener {
  private readonly logger = new Logger(
    'order:' + OnOrderProcessingSuccessListener.name,
  );

  constructor(
    private readonly orderService: OrderDomainService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(OrderProcessingSuccessEvent.EVENT_NAME)
  async handle(event: OrderProcessingSuccessEvent): Promise<void> {
    const { orderId, userId, couponId, orderItems, appliedCoupon } = event;

    try {
      const order = await this.orderService.getOrder(orderId);
      const items = orderItems.length
        ? orderItems
        : await this.orderService.getOrderItems(orderId);

      // 이미 실패/취소 등으로 상태가 바뀐 경우 스킵
      if (!order.status.isPaymentProcessing()) {
        this.logger.log(
          `[order.processing.success] 스킵 - orderId: ${orderId}, status: ${order.status.value}`,
        );
        return;
      }

      // 쿠폰 적용 (잔액 차감 전에 finalAmount 계산)
      if (appliedCoupon) {
        order.applyCoupon(appliedCoupon.id, appliedCoupon.discountRate);
        await this.orderService.updateOrder(order);
      }

      this.logger.log(
        `[order.processing.success] order.payment 발행 - orderId: ${orderId}`,
      );

      this.eventEmitter.emit(
        OrderPaymentEvent.EVENT_NAME,
        new OrderPaymentEvent(orderId, userId, couponId, order, items),
      );
    } catch (error) {
      this.logger.error(
        `[order.processing.success] 실패 - orderId: ${orderId}`,
        error,
      );

      this.eventEmitter.emit(
        OrderProcessingFailEvent.EVENT_NAME,
        new OrderProcessingFailEvent(
          orderId,
          userId,
          couponId,
          event.order,
          orderItems,
          'OnOrderProcessingSuccess',
          error as Error,
        ),
      );
    }
  }
}
