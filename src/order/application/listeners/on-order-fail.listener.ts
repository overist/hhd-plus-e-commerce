import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { OrderPaymentFailEvent } from '../events/order-payment-fail.event';
import { OrderProcessingFailEvent } from '../events/order-processing-fail.event';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { OrderProcessingFailDoneEvent } from '@/order/application/events/order-processing-fail-done.event';
import { OrderPaymentFailDoneEvent } from '@/order/application/events/order-payment-fail-done.event';

/**
 * 주문 상태 롤백 리스너
 *
 * 수신: order.processing.fail, order.payment.fail
 * 처리: 주문 상태를 PENDING으로 되돌림
 */
@Injectable()
export class OnOrderFailListener {
  private readonly logger = new Logger('order:' + OnOrderFailListener.name);

  constructor(
    private readonly orderService: OrderDomainService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * order.processing 실패 시 주문 상태 롤백
   * (PAYMENT_PROCESSING → PENDING)
   */
  @OnEvent(OrderProcessingFailEvent.EVENT_NAME)
  async handleOrderStatusRollbackOnProcessingFail(
    event: OrderProcessingFailEvent,
  ): Promise<void> {
    await this.rollbackToPending('order.processing.fail', event.orderId);
  }

  /**
   * order.payment 실패 시 주문 상태 롤백
   * (PAYMENT_PROCESSING/PAID → PENDING)
   */
  @OnEvent(OrderPaymentFailEvent.EVENT_NAME)
  async handleOrderStatusRollbackOnPaymentFail(
    event: OrderPaymentFailEvent,
  ): Promise<void> {
    await this.rollbackToPending('order.payment.fail', event.orderId);
  }

  private async rollbackToPending(
    sourceEvent: 'order.processing.fail' | 'order.payment.fail',
    orderId: number,
  ): Promise<void> {
    try {
      this.logger.log(
        `[onOrderFail] 주문 상태 롤백 시작 - source: ${sourceEvent}, orderId: ${orderId}`,
      );

      const order = await this.orderService.getOrder(orderId);

      if (order.status.isPaid() || order.status.isPaymentProcessing()) {
        order.cancelPayment();
        await this.orderService.updateOrder(order);

        this.logger.log(
          `[onOrderFail] 주문 상태 롤백 완료 - source: ${sourceEvent}, orderId: ${orderId}, status: ${order.status.value}`,
        );
        this.emitFailDone(sourceEvent, orderId);
        return;
      }

      this.logger.log(
        `[onOrderFail] 주문 상태 롤백 스킵 - source: ${sourceEvent}, orderId: ${orderId}, status: ${order.status.value}`,
      );

      this.emitFailDone(sourceEvent, orderId);
    } catch (error) {
      this.logger.error(
        `[onOrderFail] 주문 상태 롤백 실패 - source: ${sourceEvent}, orderId: ${orderId}`,
        error,
      );
    }
  }

  private emitFailDone(
    sourceEvent: 'order.processing.fail' | 'order.payment.fail',
    orderId: number,
  ): void {
    if (sourceEvent === 'order.processing.fail') {
      this.eventEmitter.emit(
        OrderProcessingFailDoneEvent.EVENT_NAME,
        new OrderProcessingFailDoneEvent(orderId, 'order'),
      );
      return;
    }

    this.eventEmitter.emit(
      OrderPaymentFailDoneEvent.EVENT_NAME,
      new OrderPaymentFailDoneEvent(orderId, 'order'),
    );
  }
}
