import { Inject, Injectable } from '@nestjs/common';
import type { Producer } from 'kafkajs';
import { KAFKA_PRODUCER } from '@common/kafka/kafka.module';

const TOPIC_ORDER_PAYMENT_SUCCESS = 'order.payment.success';
const TOPIC_ORDER_PAYMENT_FAIL = 'order.payment.fail';

export type OrderItemMessage = {
  productOptionId: number;
  productName: string;
  quantity: number;
  price: number;
};

export interface OrderPaymentSuccessMessage {
  orderId: number;
  userId: number;
  couponId: number | null;
  items: OrderItemMessage[];
  finalAmount: number;
}

export interface OrderPaymentFailMessage {
  orderId: number;
  userId: number;
  couponId: number | null;
  items: OrderItemMessage[];
  finalAmount: number;
  failedBy: string;
  errorMessage: string;
}

@Injectable()
export class UserKafkaProducer {
  constructor(@Inject(KAFKA_PRODUCER) private readonly producer: Producer) {}

  async publishOrderPaymentSuccess(
    message: OrderPaymentSuccessMessage,
  ): Promise<void> {
    await this.producer.send({
      topic: TOPIC_ORDER_PAYMENT_SUCCESS,
      messages: [
        { key: String(message.orderId), value: JSON.stringify(message) },
      ],
    });
  }

  async publishOrderPaymentFail(
    message: OrderPaymentFailMessage,
  ): Promise<void> {
    await this.producer.send({
      topic: TOPIC_ORDER_PAYMENT_FAIL,
      messages: [
        { key: String(message.orderId), value: JSON.stringify(message) },
      ],
    });
  }
}
