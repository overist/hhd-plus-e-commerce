import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { ProductKafkaProducer } from '@/product/infrastructure/product.kafka.producer';

export interface OrderProcessingFailMessage {
  orderId: number;
  items: {
    productOptionId: number;
    quantity: number;
  }[];
}

@Injectable()
export class ProductOrderProcessingFailKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(
    ProductOrderProcessingFailKafkaConsumer.name,
  );

  readonly topic = 'order.processing.fail';
  readonly groupId = 'product-order-processing-fail';

  constructor(
    private readonly productService: ProductDomainService,
    private readonly producer: ProductKafkaProducer,
  ) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const data: OrderProcessingFailMessage = JSON.parse(
      payload.message.value!.toString(),
    );

    try {
      for (const item of data.items) {
        await this.productService.restoreStockAfterPaymentFailure(
          item.productOptionId,
          item.quantity,
        );
      }
    } finally {
      await this.producer.publishOrderProcessingFailDone({
        orderId: data.orderId,
        handlerName: 'product',
      });
    }
  }
}
