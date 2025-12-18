// core
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

// event
import { OrderProcessingEvent } from '@/order/application/events/order-processing.event';
import { OrderProcessingFailEvent } from '@/order/application/events/order-processing-fail.event';
import { OrderProcessingStockSuccessEvent } from '@/order/application/events/order-processing-stock-success.event';

// service
import { ProductDomainService } from '@/product/domain/services/product.service';

/**
 * onOrderProcessing - 주문 결제 진행 시 재고 확정 차감
 *
 * 수신: order.processing
 * 성공: order.processing.stock.success 이벤트 발행
 * 실패: order.processing.fail 이벤트 발행
 */
@Injectable()
export class OnOrderProcessingListener {
  constructor(
    private readonly productService: ProductDomainService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  private readonly logger = new Logger(
    'product:' + OnOrderProcessingListener.name,
  );

  @OnEvent(OrderProcessingEvent.EVENT_NAME)
  async handleConfirmStockByOrder(event: OrderProcessingEvent): Promise<void> {
    const { orderId, orderItems } = event;

    try {
      this.logger.log(
        `[onOrderProcessing] 재고 확정 차감 시작 - orderId: ${orderId}, items: ${orderItems.length}`,
      );

      // 재고 확정 차감
      for (const item of orderItems) {
        await this.productService.confirmPaymentStock(
          item.productOptionId,
          item.quantity,
        );
      }

      this.logger.log(
        `[onOrderProcessing] 재고 확정 차감 완료 - orderId: ${orderId}`,
      );

      this.eventEmitter.emit(
        OrderProcessingStockSuccessEvent.EVENT_NAME,
        new OrderProcessingStockSuccessEvent(
          orderId,
          event.userId,
          event.couponId,
          event.order,
          orderItems,
        ),
      );
    } catch (error) {
      this.logger.error(
        `[onOrderProcessing] 재고 확정 차감 실패 - orderId: ${orderId}, error: ${error}`,
      );

      // order.processing.fail 이벤트 발행 (다른 리스너들의 보상 트랜잭션 트리거)
      this.eventEmitter.emit(
        OrderProcessingFailEvent.EVENT_NAME,
        new OrderProcessingFailEvent(
          orderId,
          event.userId,
          event.couponId,
          event.order,
          orderItems,
          'ConfirmStockByOrder',
          error as Error,
        ),
      );
    }
  }
}
