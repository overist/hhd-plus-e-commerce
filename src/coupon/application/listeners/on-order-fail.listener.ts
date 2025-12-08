// core
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

// event
import { OrderProcessingFailEvent } from '@/order/application/events/order-processing-fail.event';
import { OrderPaymentFailEvent } from '@/order/application/events/order-payment-fail.event';

// service
import { CouponRedisService } from '@/coupon/infrastructure/coupon.redis.service';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';

/**
 * 쿠폰 보상 트랜잭션 리스너
 *
 * 수신: order.processing.fail, order.payment.fail
 * 처리: 쿠폰 사용 롤백 (Redis)
 */
@Injectable()
export class OnOrderProcessingFailListener {
  constructor(
    private readonly couponRedisService: CouponRedisService,
    private readonly couponService: CouponDomainService,
  ) {}
  private readonly logger = new Logger(
    'coupon:' + OnOrderProcessingFailListener.name,
  );

  /**
   * order.processing 실패 시 쿠폰 사용 롤백
   */
  @OnEvent(OrderProcessingFailEvent.EVENT_NAME)
  async handleCouponRollbackOnProcessingFail(
    event: OrderProcessingFailEvent,
  ): Promise<void> {
    const { orderId, userId, couponId, failedListenerName } = event;

    // 쿠폰 미적용 주문인 경우 스킵
    if (!couponId) {
      return;
    }

    // 쿠폰 리스너 자체가 실패한 경우, 이미 롤백 처리되어 있음
    if (failedListenerName === 'UseUserCouponByOrder') {
      this.logger.log(
        `[onOrderProcessingFail] 쿠폰 리스너 자체 실패로 롤백 스킵 - orderId: ${orderId}`,
      );
      return;
    }

    try {
      this.logger.log(
        `[onOrderProcessingFail] 쿠폰 사용 롤백 시작 - orderId: ${orderId}, userId: ${userId}, couponId: ${couponId}`,
      );

      await this.couponRedisService.cancelCouponUse(userId, couponId, orderId);

      this.logger.log(
        `[onOrderProcessingFail] 쿠폰 사용 롤백 완료 - orderId: ${orderId}, userId: ${userId}, couponId: ${couponId}`,
      );
    } catch (error) {
      this.logger.error(
        `[onOrderProcessingFail] 쿠폰 사용 롤백 실패 - orderId: ${orderId}, userId: ${userId}, couponId: ${couponId}`,
        error,
      );
      // 보상 트랜잭션 실패는 로깅 후 별도 처리 필요 (알림, 재시도 큐 등)
    }
  }

  /**
   * order.payment 실패 시 쿠폰 사용 롤백
   * (order.processing에서 사용된 쿠폰을 롤백)
   */
  @OnEvent(OrderPaymentFailEvent.EVENT_NAME)
  async handleCouponRollbackOnPaymentFail(
    event: OrderPaymentFailEvent,
  ): Promise<void> {
    const { orderId, userId, couponId } = event;

    // 쿠폰 미적용 주문인 경우 스킵
    if (!couponId) {
      return;
    }

    try {
      this.logger.log(
        `[onOrderPaymentFail] 쿠폰 사용 롤백 시작 - orderId: ${orderId}, userId: ${userId}, couponId: ${couponId}`,
      );

      await this.couponRedisService.cancelCouponUse(userId, couponId, orderId);
      await this.couponService.deleteUserCouponByOrderId(orderId);

      this.logger.log(
        `[onOrderPaymentFail] 쿠폰 사용 롤백 완료 - orderId: ${orderId}, userId: ${userId}, couponId: ${couponId}`,
      );
    } catch (error) {
      this.logger.error(
        `[onOrderPaymentFail] 쿠폰 사용 롤백 실패 - orderId: ${orderId}, userId: ${userId}, couponId: ${couponId}`,
        error,
      );
      // 보상 트랜잭션 실패는 로깅 후 별도 처리 필요 (알림, 재시도 큐 등)
    }
  }
}
