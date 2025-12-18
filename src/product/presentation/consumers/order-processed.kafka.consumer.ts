import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { ProductDomainService } from '@/product/domain/services/product.service';

export interface OrderProcessedMessage {
  orderId: number;
  items: {
    productOptionId: number;
    productName: string;
    quantity: number;
    price: number;
  }[];
}

@Injectable()
export class ProductOrderProcessedKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(
    ProductOrderProcessedKafkaConsumer.name,
  );

  readonly topic = 'order.processed';
  readonly groupId = 'product-order-processed';

  constructor(private readonly productService: ProductDomainService) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const data: OrderProcessedMessage = JSON.parse(
      payload.message.value!.toString(),
    );

    try {
      // 판매 랭킹 업데이트 (Redis) fire and forget
      this.productService.recordSales(data.items as any);
    } catch (error) {
      this.logger.error(
        `[product:order.processed] 판매 랭킹 업데이트 실패 - orderId: ${data.orderId}`,
        error,
      );
    }
  }
}
