import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { CouponRedisService } from '@/coupon/infrastructure/coupon.redis.service';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import { CouponKafkaProducer } from '@/coupon/infrastructure/coupon.kafka.producer';

export interface OrderProcessingFailMessage {
  orderId: number;
  userId: number;
  couponId: number | null;
  failedBy: string;
}

@Injectable()
export class CouponOrderProcessingFailKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(
    CouponOrderProcessingFailKafkaConsumer.name,
  );

  readonly topic = 'order.processing.fail';
  readonly groupId = 'coupon-order-processing-fail';

  constructor(
    private readonly couponRedisService: CouponRedisService,
    private readonly couponService: CouponDomainService,
    private readonly producer: CouponKafkaProducer,
  ) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const data: OrderProcessingFailMessage = JSON.parse(
      payload.message.value!.toString(),
    );

    const { orderId, userId, couponId, failedBy } = data;

    if (!couponId) {
      await this.producer.publishOrderProcessingFailDone({
        orderId,
        handlerName: 'coupon',
      });
      return;
    }

    // 쿠폰 리스너 자체가 실패한 경우, 이미 롤백 처리되어 있음
    if (failedBy === 'UseUserCouponByOrder') {
      await this.producer.publishOrderProcessingFailDone({
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
        `[coupon:order.processing.fail] 쿠폰 롤백 실패 - orderId: ${orderId}`,
        error,
      );
    } finally {
      await this.producer.publishOrderProcessingFailDone({
        orderId,
        handlerName: 'coupon',
      });
    }
  }
}
