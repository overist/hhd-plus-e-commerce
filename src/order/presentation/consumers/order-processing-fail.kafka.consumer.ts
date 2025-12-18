import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { OrderKafkaProducer } from '@/order/infrastructure/order.kafka.producer';
import { OrderProcessingStateStore } from '@/order/infrastructure/order-processing-state.store';

export interface OrderProcessingFailMessage {
  orderId: number;
  userId?: number;
  couponId?: number | null;
  items?: {
    productOptionId: number;
    productName: string;
    quantity: number;
    price: number;
  }[];
  failedBy?: string;
  errorMessage?: string;
}

@Injectable()
export class OrderProcessingFailKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(OrderProcessingFailKafkaConsumer.name);

  readonly topic = 'order.processing.fail';
  readonly groupId = 'order-order-processing-fail';

  constructor(
    private readonly store: OrderProcessingStateStore,
    private readonly orderService: OrderDomainService,
    private readonly orderKafkaProducer: OrderKafkaProducer,
  ) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const data: OrderProcessingFailMessage = JSON.parse(
      payload.message.value!.toString(),
    );

    try {
      const order = await this.orderService.getOrder(data.orderId);
      if (order.status.isPaid() || order.status.isPaymentProcessing()) {
        order.cancelPayment();
        await this.orderService.updateOrder(order);
      }
    } catch (error) {
      this.logger.error(
        `[order.processing.fail] 주문 상태 롤백 실패 - orderId: ${data.orderId}`,
        error as Error,
      );
    } finally {
      await this.store.clear(data.orderId);

      await this.orderKafkaProducer.publishOrderProcessingFailDone({
        orderId: data.orderId,
        handlerName: 'order',
      });
    }
  }
}
