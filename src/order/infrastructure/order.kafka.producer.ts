import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Producer } from 'kafkajs';
import { KAFKA_PRODUCER } from '@common/kafka/kafka.module';

const TOPIC_ORDER_PROCESSED = 'order.processed';

export interface OrderProcessedMessage {
  orderId: number;
  userId: number;
  finalAmount: number;
  couponId: number | null;
  items: {
    productOptionId: number;
    productName: string;
    quantity: number;
    price: number;
  }[];
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

  /**
   * 주문 완료 메시지를 Kafka로 발행
   */
  async publishOrderProcessed(message: OrderProcessedMessage): Promise<void> {
    await this.kafkaProducer.send({
      topic: TOPIC_ORDER_PROCESSED,
      messages: [
        {
          key: String(message.orderId),
          value: JSON.stringify(message),
        },
      ],
    });

    this.logger.log(
      `[Kafka] 주문 데이터 발행 완료 - topic: ${TOPIC_ORDER_PROCESSED}, orderId: ${message.orderId}`,
    );
  }
}
