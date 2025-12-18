import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { CouponRedisService } from '@/coupon/infrastructure/coupon.redis.service';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import { CouponKafkaProducer } from '@/coupon/infrastructure/coupon.kafka.producer';

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
export class CouponOrderProcessingKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(
    CouponOrderProcessingKafkaConsumer.name,
  );

  readonly topic = 'order.processing';
  readonly groupId = 'coupon-order-processing';

  constructor(
    private readonly couponRedisService: CouponRedisService,
    private readonly couponService: CouponDomainService,
    private readonly producer: CouponKafkaProducer,
  ) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const data: OrderProcessingMessage = JSON.parse(
      payload.message.value!.toString(),
    );
    const { orderId, userId, couponId } = data;

    // 쿠폰 미적용이면 스킵(코디네이터가 init에서 couponOk=true 처리)
    if (!couponId) return;

    try {
      const coupon = await this.couponRedisService.getCachedCoupon(couponId);
      const userCoupon = await this.couponRedisService.useUserCoupon(
        userId,
        coupon.id,
        orderId,
      );

      await this.couponService.createUserCoupon(userCoupon);

      await this.producer.publishOrderProcessingCouponSuccess({
        orderId,
        userId,
        couponId: coupon.id,
        appliedCoupon: { id: coupon.id, discountRate: coupon.discountRate },
      });
    } catch (error) {
      this.logger.error(
        `[coupon:order.processing] 쿠폰 사용 처리 실패 - orderId: ${orderId}`,
        error,
      );

      // 쿠폰 사용 처리 실패시 레디스 롤백 (자체 롤백)
      await this.couponRedisService.cancelCouponUse(userId, couponId, orderId);

      await this.producer.publishOrderProcessingFail({
        orderId,
        userId,
        couponId,
        items: data.items,
        failedBy: 'UseUserCouponByOrder',
        errorMessage: (error as Error)?.message ?? String(error),
      });
    }
  }
}
