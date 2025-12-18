import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { OrderKafkaProducer } from '@/order/infrastructure/order.kafka.producer';
import { OrderProcessingStateStore } from '@/order/infrastructure/order-processing-state.store';

export interface OrderProcessingSuccessMessage {
  orderId: number;
  userId: number;
  couponId: number | null;
  items: {
    productOptionId: number;
    productName: string;
    quantity: number;
    price: number;
  }[];
  appliedCoupon: { id: number; discountRate: number } | null;
}

/**
 * order.processing.success
 * - 쿠폰 할인 반영(주문 업데이트)
 * - order.payment 발행
 */
@Injectable()
export class OrderProcessingSuccessKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(
    OrderProcessingSuccessKafkaConsumer.name,
  );

  readonly topic = 'order.processing.success';
  readonly groupId = 'order-processing-success';

  constructor(
    private readonly orderService: OrderDomainService,
    private readonly orderKafkaProducer: OrderKafkaProducer,
    private readonly store: OrderProcessingStateStore,
  ) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const data: OrderProcessingSuccessMessage = JSON.parse(
      payload.message.value!.toString(),
    );

    const order = await this.orderService.getOrder(data.orderId);

    // 이미 실패/취소 등으로 상태가 바뀐 경우 스킵
    if (!order.status.isPaymentProcessing()) {
      this.logger.log(
        `[order.processing.success] 스킵 - orderId: ${data.orderId}, status: ${order.status.value}`,
      );
      return;
    }

    // 쿠폰 적용 (잔액 차감 전에 finalAmount 계산)
    if (data.appliedCoupon) {
      order.applyCoupon(data.appliedCoupon.id, data.appliedCoupon.discountRate);
      await this.orderService.updateOrder(order);
    }

    await this.orderKafkaProducer.publishOrderPayment({
      orderId: data.orderId,
      userId: data.userId,
      couponId: data.couponId,
      items: data.items,
      finalAmount: order.finalAmount,
    });

    await this.store.clear(data.orderId);
  }
}
