import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { OrderKafkaProducer } from '@/order/infrastructure/order.kafka.producer';

export interface OrderPaymentFailMessage {
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
  failedBy: string;
  errorMessage: string;
}

/**
 * order.payment.fail
 * - 주문 상태 롤백(PENDING)
 * - order.payment.fail.done 발행
 */
@Injectable()
export class OrderPaymentFailKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(OrderPaymentFailKafkaConsumer.name);

  readonly topic = 'order.payment.fail';
  readonly groupId = 'order-payment-fail';

  constructor(
    private readonly orderService: OrderDomainService,
    private readonly orderKafkaProducer: OrderKafkaProducer,
  ) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const data: OrderPaymentFailMessage = JSON.parse(
      payload.message.value!.toString(),
    );

    try {
      const order = await this.orderService.getOrder(data.orderId);

      if (order.status.isPaid() || order.status.isPaymentProcessing()) {
        order.cancelPayment();
        await this.orderService.updateOrder(order);
      }

      await this.orderKafkaProducer.publishOrderPaymentFailDone({
        orderId: data.orderId,
        handlerName: 'order',
      });
    } catch (error) {
      this.logger.error(
        `[order.payment.fail] 주문 상태 롤백 실패 - orderId: ${data.orderId}`,
        error as Error,
      );
    }
  }
}
