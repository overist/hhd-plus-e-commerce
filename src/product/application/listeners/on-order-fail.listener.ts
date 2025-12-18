// core
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';

// event
import { OrderProcessingFailEvent } from '@/order/application/events/order-processing-fail.event';
import { OrderPaymentFailEvent } from '@/order/application/events/order-payment-fail.event';
import { OrderProcessingFailDoneEvent } from '@/order/application/events/order-processing-fail-done.event';
import { OrderPaymentFailDoneEvent } from '@/order/application/events/order-payment-fail-done.event';

// service
import { ProductDomainService } from '@/product/domain/services/product.service';

/**
 * 재고 보상 트랜잭션 리스너
 *
 * 수신: order.processing.fail, order.payment.fail
 * 처리: 재고 확정 차감 롤백
 */
@Injectable()
export class OnOrderFailListener {
  constructor(
    private readonly productService: ProductDomainService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  private readonly logger = new Logger('product:' + OnOrderFailListener.name);

  /**
   * order.processing 실패 시 재고 롤백
   */
  @OnEvent(OrderProcessingFailEvent.EVENT_NAME)
  async handleStockRollbackOnProcessingFail(
    event: OrderProcessingFailEvent,
  ): Promise<void> {
    const { orderId, orderItems, failedListenerName } = event;

    // 재고 리스너 자체가 실패한 경우, 부분적으로 처리됐을 수 있으므로 롤백 시도
    // 쿠폰 리스너가 실패한 경우에도 재고는 이미 차감되었을 수 있음
    if (failedListenerName === 'ConfirmStockByOrder') {
      this.logger.log(
        `[onOrderProcessingFail] 재고 리스너 자체 실패 - 부분 롤백 시도 - orderId: ${orderId}`,
      );
    }

    try {
      this.logger.log(
        `[onOrderProcessingFail] 재고 롤백 시작 - orderId: ${orderId}, items: ${orderItems.length}`,
      );

      for (const item of orderItems) {
        try {
          await this.productService.restoreStockAfterPaymentFailure(
            item.productOptionId,
            item.quantity,
          );
        } catch (itemError) {
          this.logger.error(
            `[onOrderProcessingFail] 개별 재고 롤백 실패 - orderId: ${orderId}, productOptionId: ${item.productOptionId}`,
            itemError,
          );
        }
      }

      this.logger.log(
        `[onOrderProcessingFail] 재고 롤백 완료 - orderId: ${orderId}`,
      );
    } catch (error) {
      this.logger.error(
        `[onOrderProcessingFail] 재고 롤백 실패 - orderId: ${orderId}`,
        error,
      );
      // 보상 트랜잭션 실패는 로깅 후 별도 처리 필요 (알림, 재시도 큐 등)
    } finally {
      this.eventEmitter.emit(
        OrderProcessingFailDoneEvent.EVENT_NAME,
        new OrderProcessingFailDoneEvent(orderId, 'product'),
      );
    }
  }

  /**
   * order.payment 실패 시 재고 롤백
   * (order.processing에서 확정 차감된 재고를 롤백)
   */
  @OnEvent(OrderPaymentFailEvent.EVENT_NAME)
  async handleStockRollbackOnPaymentFail(
    event: OrderPaymentFailEvent,
  ): Promise<void> {
    const { orderId, orderItems } = event;

    try {
      this.logger.log(
        `[onOrderPaymentFail] 재고 롤백 시작 - orderId: ${orderId}, items: ${orderItems.length}`,
      );

      for (const item of orderItems) {
        try {
          await this.productService.restoreStockAfterPaymentFailure(
            item.productOptionId,
            item.quantity,
          );
        } catch (itemError) {
          this.logger.error(
            `[onOrderPaymentFail] 개별 재고 롤백 실패 - orderId: ${orderId}, productOptionId: ${item.productOptionId}`,
            itemError,
          );
        }
      }

      this.logger.log(
        `[onOrderPaymentFail] 재고 롤백 완료 - orderId: ${orderId}`,
      );
    } catch (error) {
      this.logger.error(
        `[onOrderPaymentFail] 재고 롤백 실패 - orderId: ${orderId}`,
        error,
      );
      // 보상 트랜잭션 실패는 로깅 후 별도 처리 필요 (알림, 재시도 큐 등)
    } finally {
      this.eventEmitter.emit(
        OrderPaymentFailDoneEvent.EVENT_NAME,
        new OrderPaymentFailDoneEvent(orderId, 'product'),
      );
    }
  }
}
