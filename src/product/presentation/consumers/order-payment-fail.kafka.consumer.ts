import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { ProductKafkaProducer } from '@/product/infrastructure/product.kafka.producer';

export interface OrderPaymentFailMessage {
  orderId: number;
  items: {
    productOptionId: number;
    quantity: number;
  }[];
}

@Injectable()
export class ProductOrderPaymentFailKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(
    ProductOrderPaymentFailKafkaConsumer.name,
  );

  readonly topic = 'order.payment.fail';
  readonly groupId = 'product-order-payment-fail';

  constructor(
    private readonly productService: ProductDomainService,
    private readonly producer: ProductKafkaProducer,
  ) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const data: OrderPaymentFailMessage = JSON.parse(
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
      await this.producer.publishOrderPaymentFailDone({
        orderId: data.orderId,
        handlerName: 'product',
      });
    }
  }
}
