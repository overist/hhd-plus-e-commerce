import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { OrderProcessingStateStore } from '@/order/infrastructure/order-processing-state.store';
import { OrderKafkaProducer } from '@/order/infrastructure/order.kafka.producer';

export interface OrderProcessingCouponSuccessMessage {
  orderId: number;
  userId: number;
  couponId: number;
  appliedCoupon: { id: number; discountRate: number };
}

@Injectable()
export class OrderProcessingCouponSuccessKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(
    OrderProcessingCouponSuccessKafkaConsumer.name,
  );

  readonly topic = 'order.processing.coupon.success';
  readonly groupId = 'order-order-processing-coupon-success';

  constructor(
    private readonly store: OrderProcessingStateStore,
    private readonly orderKafkaProducer: OrderKafkaProducer,
  ) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const data: OrderProcessingCouponSuccessMessage = JSON.parse(
      payload.message.value!.toString(),
    );

    const ready = await this.store.markCouponOk(
      data.orderId,
      data.appliedCoupon,
    );
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
