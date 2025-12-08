// core
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

// event
import { OrderProcessingEvent } from '@/order/application/events/order-processing.event';

// service
import { ProductDomainService } from '@/product/domain/services/product.service';

/**
 * onOrderProcessing - 주문 결제 진행 시 재고 확정 차감
 *
 * 수신: order.processing
 * 반환: ConfirmStockByOrderResult (동기적 응답)
 */
@Injectable()
export class OnOrderProcessingListener {
  constructor(private readonly productService: ProductDomainService) {}
  private readonly logger = new Logger(OnOrderProcessingListener.name);

  @OnEvent(OrderProcessingEvent.EVENT_NAME)
  async handleConfirmStockByOrder(
    event: OrderProcessingEvent,
  ): Promise<ConfirmStockByOrderResult> {
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

      return {
        listenerName: 'ConfirmStockByOrder',
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `[onOrderProcessing] 재고 확정 차감 실패 - orderId: ${orderId}, error: ${error}`,
      );

      return {
        listenerName: 'ConfirmStockByOrder',
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

export interface ConfirmStockByOrderResult {
  listenerName: 'ConfirmStockByOrder';
  success: boolean;
  error?: Error;
}
