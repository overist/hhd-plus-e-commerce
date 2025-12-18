import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Producer } from 'kafkajs';
import { KAFKA_PRODUCER } from '@common/kafka/kafka.module';

const TOPIC_ORDER_PROCESSING = 'order.processing';
const TOPIC_ORDER_PROCESSING_SUCCESS = 'order.processing.success';
const TOPIC_ORDER_PROCESSING_FAIL = 'order.processing.fail';
const TOPIC_ORDER_PROCESSING_FAIL_DONE = 'order.processing.fail.done';

const TOPIC_ORDER_PAYMENT = 'order.payment';
const TOPIC_ORDER_PAYMENT_SUCCESS = 'order.payment.success';
const TOPIC_ORDER_PAYMENT_FAIL = 'order.payment.fail';
const TOPIC_ORDER_PAYMENT_FAIL_DONE = 'order.payment.fail.done';

const TOPIC_ORDER_PROCESSED = 'order.processed';

export type OrderItemMessage = {
  productOptionId: number;
  productName: string;
  quantity: number;
  price: number;
};

export interface OrderProcessingMessage {
  orderId: number;
  userId: number;
  couponId: number | null;
  items: OrderItemMessage[];
}

export interface OrderProcessingSuccessMessage {
  orderId: number;
  userId: number;
  couponId: number | null;
  items: OrderItemMessage[];
  appliedCoupon: { id: number; discountRate: number } | null;
}

export interface OrderProcessingFailMessage {
  orderId: number;
  userId: number;
  couponId: number | null;
  items: OrderItemMessage[];
  failedBy: string;
  errorMessage: string;
}

export interface OrderPaymentMessage {
  orderId: number;
  userId: number;
  couponId: number | null;
  items: OrderItemMessage[];
  finalAmount: number;
}

export interface OrderPaymentSuccessMessage extends OrderPaymentMessage {}

export interface OrderPaymentFailMessage {
  orderId: number;
  userId: number;
  couponId: number | null;
  items: OrderItemMessage[];
  finalAmount: number;
  failedBy: string;
  errorMessage: string;
}

export interface OrderFailDoneMessage {
  orderId: number;
  handlerName: 'order' | 'product' | 'coupon';
}

export interface OrderProcessedMessage {
  orderId: number;
  userId: number;
  finalAmount: number;
  couponId: number | null;
  items: OrderItemMessage[];
  processedAt: string;
}

/**
 * Order Kafka Producer (Infrastructure Service)
 * - 주문 관련 Kafka 메시지 발행을 담당하는 인프라 서비스
 */
@Injectable()
export class OrderKafkaProducer {
  private readonly logger = new Logger(OrderKafkaProducer.name);

  constructor(
    @Inject(KAFKA_PRODUCER) private readonly kafkaProducer: Producer,
  ) {}

  async publishOrderProcessing(message: OrderProcessingMessage): Promise<void> {
    await this.kafkaProducer.send({
      topic: TOPIC_ORDER_PROCESSING,
      messages: [
        { key: String(message.orderId), value: JSON.stringify(message) },
      ],
    });
  }

  async publishOrderProcessingSuccess(
    message: OrderProcessingSuccessMessage,
  ): Promise<void> {
    await this.kafkaProducer.send({
      topic: TOPIC_ORDER_PROCESSING_SUCCESS,
      messages: [
        { key: String(message.orderId), value: JSON.stringify(message) },
      ],
    });
  }

  async publishOrderProcessingFail(
    message: OrderProcessingFailMessage,
  ): Promise<void> {
    await this.kafkaProducer.send({
      topic: TOPIC_ORDER_PROCESSING_FAIL,
      messages: [
        { key: String(message.orderId), value: JSON.stringify(message) },
      ],
    });
  }

  async publishOrderProcessingFailDone(
    message: OrderFailDoneMessage,
  ): Promise<void> {
    await this.kafkaProducer.send({
      topic: TOPIC_ORDER_PROCESSING_FAIL_DONE,
      messages: [
        { key: String(message.orderId), value: JSON.stringify(message) },
      ],
    });
  }

  async publishOrderPayment(message: OrderPaymentMessage): Promise<void> {
    await this.kafkaProducer.send({
      topic: TOPIC_ORDER_PAYMENT,
      messages: [
        { key: String(message.orderId), value: JSON.stringify(message) },
      ],
    });
  }

  async publishOrderPaymentSuccess(
    message: OrderPaymentSuccessMessage,
  ): Promise<void> {
    await this.kafkaProducer.send({
      topic: TOPIC_ORDER_PAYMENT_SUCCESS,
      messages: [
        { key: String(message.orderId), value: JSON.stringify(message) },
      ],
    });
  }

  async publishOrderPaymentFail(
    message: OrderPaymentFailMessage,
  ): Promise<void> {
    await this.kafkaProducer.send({
      topic: TOPIC_ORDER_PAYMENT_FAIL,
      messages: [
        { key: String(message.orderId), value: JSON.stringify(message) },
      ],
    });
  }

  async publishOrderPaymentFailDone(
    message: OrderFailDoneMessage,
  ): Promise<void> {
    await this.kafkaProducer.send({
      topic: TOPIC_ORDER_PAYMENT_FAIL_DONE,
      messages: [
        { key: String(message.orderId), value: JSON.stringify(message) },
      ],
    });
  }

  /**
   * 주문 완료 메시지를 Kafka로 발행
   */
  async publishOrderProcessed(message: OrderProcessedMessage): Promise<void> {
    await this.kafkaProducer.send({
      topic: TOPIC_ORDER_PROCESSED,
      messages: [
        {
          // key: String(message.orderId),
          value: JSON.stringify(message),
        },
      ],
    });

    this.logger.log(
      `[Kafka] 주문 데이터 발행 완료 - topic: ${TOPIC_ORDER_PROCESSED}, orderId: ${message.orderId}`,
    );
  }
}
