import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderProcessedEvent } from '../events/order-processed.event';

/**
 * onOrderProcessed - 주문 결제 완료 시 외부 데이터 플랫폼 전송
 *
 * 수신: order.processed
 * 동작: 주문 데이터를 외부 시스템(데이터 웨어하우스, 분석 플랫폼 등)에 전송
 *
 * TODO: 실제 외부 플랫폼 연동 시 구현
 */
@Injectable()
export class OnOrderProcessedListener {
  private readonly logger = new Logger(OnOrderProcessedListener.name);

  @OnEvent(OrderProcessedEvent.EVENT_NAME)
  async handle(event: OrderProcessedEvent): Promise<void> {
    try {
      // TODO: 외부 데이터 플랫폼으로 주문 데이터 전송
      // mock implementation
      await new Promise((resolve) => setTimeout(resolve, 100));

      this.logger.log(
        `[onOrderProcessed] 데이터 플랫폼 전송 - orderId: ${event.order.id}, amount: ${event.order.finalAmount}`,
      );
    } catch (error) {
      // 데이터 플랫폼 전송 실패는 결제에 영향을 주지 않음
      this.logger.error(
        `[onOrderProcessed] 데이터 플랫폼 전송 실패 - orderId: ${event.order.id}`,
        error,
      );
    }
  }
}
