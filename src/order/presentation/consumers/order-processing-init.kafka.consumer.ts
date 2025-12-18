import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { OrderProcessingStateStore } from '@/order/infrastructure/order-processing-state.store';

export interface OrderProcessingMessage {
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

/**
 * order.processing
 * - 코디네이터 상태 초기화(분산 환경: Redis)
 */
@Injectable()
export class OrderProcessingInitKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(OrderProcessingInitKafkaConsumer.name);

  readonly topic = 'order.processing';
  readonly groupId = 'order-order-processing-init';

  constructor(private readonly store: OrderProcessingStateStore) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const data: OrderProcessingMessage = JSON.parse(
      payload.message.value!.toString(),
    );

    await this.store.init({
      orderId: data.orderId,
      userId: data.userId,
      couponId: data.couponId,
      items: data.items,
      stockOk: false,
      couponOk: data.couponId ? false : true,
      appliedCoupon: null,
    });
  }
}
