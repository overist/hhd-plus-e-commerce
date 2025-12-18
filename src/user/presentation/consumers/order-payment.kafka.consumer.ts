import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { UserDomainService } from '@/user/domain/services/user.service';
import { UserKafkaProducer } from '@/user/infrastructure/user.kafka.producer';

export interface OrderPaymentMessage {
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

@Injectable()
export class UserOrderPaymentKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(UserOrderPaymentKafkaConsumer.name);

  readonly topic = 'order.payment';
  readonly groupId = 'user-order-payment';

  constructor(
    private readonly userService: UserDomainService,
    private readonly producer: UserKafkaProducer,
  ) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const data: OrderPaymentMessage = JSON.parse(
      payload.message.value!.toString(),
    );

    try {
      await this.userService.deductBalance(
        data.userId,
        data.finalAmount,
        data.orderId,
        `주문 ${data.orderId} 결제`,
      );

      await this.producer.publishOrderPaymentSuccess({
        orderId: data.orderId,
        userId: data.userId,
        couponId: data.couponId,
        items: data.items,
        finalAmount: data.finalAmount,
      });
    } catch (error) {
      this.logger.warn(
        `[user:order.payment] 잔액 차감 실패 - orderId: ${data.orderId}, userId: ${data.userId}`,
      );

      await this.producer.publishOrderPaymentFail({
        orderId: data.orderId,
        userId: data.userId,
        couponId: data.couponId,
        items: data.items,
        finalAmount: data.finalAmount,
        failedBy: 'UserBalanceDeductByOrder',
        errorMessage: (error as Error)?.message ?? String(error),
      });
    }
  }
}
