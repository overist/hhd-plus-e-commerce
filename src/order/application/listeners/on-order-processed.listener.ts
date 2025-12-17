import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderProcessedEvent } from '../events/order-processed.event';
import { OrderKafkaProducer } from '../../infrastructure/order.kafka.producer';

/**
 * onOrderProcessed - 주문 결제 완료 시 외부 데이터 플랫폼 전송
 *
 * 수신: order.processed
 * 동작: 주문 데이터를 Kafka 토픽으로 발행, 외부 시스템이 구독하거나 컨슈머가 처리
 */
@Injectable()
export class OnOrderProcessedListener {
  private readonly logger = new Logger(
    'order:' + OnOrderProcessedListener.name,
  );

  constructor(private readonly orderKafkaProducer: OrderKafkaProducer) {}

  @OnEvent(OrderProcessedEvent.EVENT_NAME)
  async handle(event: OrderProcessedEvent): Promise<void> {
    try {
      const message = {
        orderId: event.orderId,
        userId: event.userId,
        finalAmount: event.order.finalAmount,
        couponId: event.couponId,
        items: event.orderItems.map((item) => ({
          productOptionId: item.productOptionId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
        })),
        processedAt: new Date().toISOString(),
      };

      await this.orderKafkaProducer.publishOrderProcessed(message);

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
