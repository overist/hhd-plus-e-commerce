import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { ProductKafkaProducer } from '@/product/infrastructure/product.kafka.producer';

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

@Injectable()
export class ProductOrderProcessingKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(
    ProductOrderProcessingKafkaConsumer.name,
  );

  readonly topic = 'order.processing';
  readonly groupId = 'product-order-processing';

  constructor(
    private readonly productService: ProductDomainService,
    private readonly producer: ProductKafkaProducer,
  ) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const data: OrderProcessingMessage = JSON.parse(
      payload.message.value!.toString(),
    );

    try {
      for (const item of data.items) {
        await this.productService.confirmPaymentStock(
          item.productOptionId,
          item.quantity,
        );
      }

      await this.producer.publishOrderProcessingStockSuccess({
        orderId: data.orderId,
        userId: data.userId,
        couponId: data.couponId,
        items: data.items,
      });
    } catch (error) {
      this.logger.error(
        `[product:order.processing] 재고 확정 실패 - orderId: ${data.orderId}`,
        error,
      );

      await this.producer.publishOrderProcessingFail({
        orderId: data.orderId,
        userId: data.userId,
        couponId: data.couponId,
        items: data.items,
        failedBy: 'ConfirmStockByOrder',
        errorMessage: (error as Error)?.message ?? String(error),
      });
    }
  }
}
