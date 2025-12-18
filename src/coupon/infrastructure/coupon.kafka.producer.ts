import { Inject, Injectable } from '@nestjs/common';
import type { Producer } from 'kafkajs';
import { KAFKA_PRODUCER } from '@common/kafka/kafka.module';

const TOPIC_ORDER_PROCESSING_COUPON_SUCCESS = 'order.processing.coupon.success';
const TOPIC_ORDER_PROCESSING_FAIL = 'order.processing.fail';
const TOPIC_ORDER_PROCESSING_FAIL_DONE = 'order.processing.fail.done';
const TOPIC_ORDER_PAYMENT_FAIL_DONE = 'order.payment.fail.done';

export interface OrderProcessingCouponSuccessMessage {
  orderId: number;
  userId: number;
  couponId: number;
  appliedCoupon: { id: number; discountRate: number };
}

export interface OrderProcessingFailMessage {
  orderId: number;
  userId: number;
  couponId: number | null;
  items: {
    productOptionId: number;
    productName: string;
    quantity: number;
    price: number;
  }[];
  failedBy: string;
  errorMessage: string;
}

export interface OrderFailDoneMessage {
  orderId: number;
  handlerName: 'order' | 'product' | 'coupon';
}

@Injectable()
export class CouponKafkaProducer {
  constructor(@Inject(KAFKA_PRODUCER) private readonly producer: Producer) {}

  async publishOrderProcessingCouponSuccess(
    message: OrderProcessingCouponSuccessMessage,
  ): Promise<void> {
    await this.producer.send({
      topic: TOPIC_ORDER_PROCESSING_COUPON_SUCCESS,
      messages: [
        { key: String(message.orderId), value: JSON.stringify(message) },
      ],
    });
  }

  async publishOrderProcessingFail(
    message: OrderProcessingFailMessage,
  ): Promise<void> {
    await this.producer.send({
      topic: TOPIC_ORDER_PROCESSING_FAIL,
      messages: [
        { key: String(message.orderId), value: JSON.stringify(message) },
      ],
    });
  }

  async publishOrderProcessingFailDone(
    message: OrderFailDoneMessage,
  ): Promise<void> {
    await this.producer.send({
      topic: TOPIC_ORDER_PROCESSING_FAIL_DONE,
      messages: [
        { key: String(message.orderId), value: JSON.stringify(message) },
      ],
    });
  }

  async publishOrderPaymentFailDone(
    message: OrderFailDoneMessage,
  ): Promise<void> {
    await this.producer.send({
      topic: TOPIC_ORDER_PAYMENT_FAIL_DONE,
      messages: [
        { key: String(message.orderId), value: JSON.stringify(message) },
      ],
    });
  }
}
