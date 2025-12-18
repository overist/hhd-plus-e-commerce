import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { CouponRedisService } from '@/coupon/infrastructure/coupon.redis.service';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import { CouponKafkaProducer } from '@/coupon/infrastructure/coupon.kafka.producer';

export interface OrderPaymentFailMessage {
  orderId: number;
  userId: number;
  couponId: number | null;
}

@Injectable()
export class CouponOrderPaymentFailKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(
    CouponOrderPaymentFailKafkaConsumer.name,
  );

  readonly topic = 'order.payment.fail';
  readonly groupId = 'coupon-order-payment-fail';

  constructor(
    private readonly couponRedisService: CouponRedisService,
    private readonly couponService: CouponDomainService,
    private readonly producer: CouponKafkaProducer,
  ) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const data: OrderPaymentFailMessage = JSON.parse(
      payload.message.value!.toString(),
    );

    const { orderId, userId, couponId } = data;

    if (!couponId) {
      await this.producer.publishOrderPaymentFailDone({
        orderId,
        handlerName: 'coupon',
      });
      return;
    }

    try {
      await this.couponRedisService.cancelCouponUse(userId, couponId, orderId);
      await this.couponService.deleteUserCouponByOrderId(orderId);
    } catch (error) {
      this.logger.error(
        `[coupon:order.payment.fail] 쿠폰 롤백 실패 - orderId: ${orderId}`,
        error,
      );
    } finally {
      await this.producer.publishOrderPaymentFailDone({
        orderId,
        handlerName: 'coupon',
      });
    }
  }
}
