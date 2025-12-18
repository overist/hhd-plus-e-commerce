import { Inject, Injectable } from '@nestjs/common';
import type { Producer } from 'kafkajs';
import { KAFKA_PRODUCER } from '@common/kafka/kafka.module';

const TOPIC_ORDER_PROCESSING_STOCK_SUCCESS = 'order.processing.stock.success';
const TOPIC_ORDER_PROCESSING_FAIL = 'order.processing.fail';
const TOPIC_ORDER_PROCESSING_FAIL_DONE = 'order.processing.fail.done';
const TOPIC_ORDER_PAYMENT_FAIL_DONE = 'order.payment.fail.done';

export type OrderItemMessage = {
  productOptionId: number;
  productName: string;
  quantity: number;
  price: number;
};

export interface OrderProcessingStockSuccessMessage {
  orderId: number;
  userId: number;
  couponId: number | null;
  items: OrderItemMessage[];
}

export interface OrderProcessingFailMessage {
  orderId: number;
  userId: number;
  couponId: number | null;
  items: OrderItemMessage[];
  failedBy: string;
  errorMessage: string;
}

export interface OrderFailDoneMessage {
  orderId: number;
  handlerName: 'order' | 'product' | 'coupon';
}

@Injectable()
export class ProductKafkaProducer {
  constructor(@Inject(KAFKA_PRODUCER) private readonly producer: Producer) {}

  async publishOrderProcessingStockSuccess(
    message: OrderProcessingStockSuccessMessage,
  ): Promise<void> {
    await this.producer.send({
      topic: TOPIC_ORDER_PROCESSING_STOCK_SUCCESS,
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
