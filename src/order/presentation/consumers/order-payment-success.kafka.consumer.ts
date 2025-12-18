import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { OrderKafkaProducer } from '@/order/infrastructure/order.kafka.producer';

export interface OrderPaymentSuccessMessage {
  orderId: number;
  userId: number;
  couponId: number | null;
  items: {
    productOptionId: number;
    productName: string;
    quantity: number;
    price: number;
  }[];
  finalAmount: number;
}

/**
 * order.payment.success
 * - 주문 결제 완료 처리(PAID)
 * - order.processed 발행 (외부 플랫폼/인기상품 집계)
 */
@Injectable()
export class OrderPaymentSuccessKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(OrderPaymentSuccessKafkaConsumer.name);

  readonly topic = 'order.payment.success';
  readonly groupId = 'order-payment-success';

  constructor(
    private readonly orderService: OrderDomainService,
    private readonly orderKafkaProducer: OrderKafkaProducer,
  ) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const data: OrderPaymentSuccessMessage = JSON.parse(
      payload.message.value!.toString(),
    );

    const order = await this.orderService.getOrder(data.orderId);
    if (!order.status.isPaid()) {
      order.completePayment();
      await this.orderService.updateOrder(order);
    }

    await this.orderKafkaProducer.publishOrderProcessed({
      orderId: data.orderId,
      userId: data.userId,
      finalAmount: order.finalAmount,
      couponId: data.couponId,
      items: data.items,
      processedAt: new Date().toISOString(),
    });
  }
}
