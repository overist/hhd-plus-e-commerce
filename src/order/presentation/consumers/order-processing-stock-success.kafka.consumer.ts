import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { OrderProcessingStateStore } from '@/order/infrastructure/order-processing-state.store';
import { OrderKafkaProducer } from '@/order/infrastructure/order.kafka.producer';

export interface OrderProcessingStockSuccessMessage {
  orderId: number;
  userId: number;
  couponId: number | null;
  items: {
    productOptionId: number;
    productName: string;
    quantity: number;
    price: number;
  }[];
}

@Injectable()
export class OrderProcessingStockSuccessKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(
    OrderProcessingStockSuccessKafkaConsumer.name,
  );

  readonly topic = 'order.processing.stock.success';
  readonly groupId = 'order-order-processing-stock-success';

  constructor(
    private readonly store: OrderProcessingStateStore,
    private readonly orderKafkaProducer: OrderKafkaProducer,
  ) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const data: OrderProcessingStockSuccessMessage = JSON.parse(
      payload.message.value!.toString(),
    );

    const ready = await this.store.markStockOk(data.orderId);
    if (!ready) return;

    const state = await this.store.get(data.orderId);
    if (!state) return;

    await this.orderKafkaProducer.publishOrderProcessingSuccess({
      orderId: state.orderId,
      userId: state.userId,
      couponId: state.couponId,
      items: state.items,
      appliedCoupon: state.appliedCoupon,
    });
    await this.store.clear(state.orderId);
  }
}
