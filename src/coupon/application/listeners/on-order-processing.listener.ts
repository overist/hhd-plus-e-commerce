// core
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

// event
import { OrderProcessingEvent } from '@/order/application/events/order-processing.event';
import { OrderProcessingFailEvent } from '@/order/application/events/order-processing-fail.event';

// service
import { CouponRedisService } from '@/coupon/infrastructure/coupon.redis.service';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';

// domain entities
import { Coupon } from '@/coupon/domain/entities/coupon.entity';
import { UserCoupon } from '@/coupon/domain/entities/user-coupon.entity';

/**
 * onOrderProcessing - 주문 결제 진행 시 쿠폰 사용 처리
 *
 * 수신: order.processing
 * 반환: UseUserCouponByOrderResult (동기적 응답)
 * 실패: order.processing.fail 이벤트 발행
 */
@Injectable()
export class OnOrderProcessingListener {
  constructor(
    private readonly couponRedisService: CouponRedisService,
    private readonly couponService: CouponDomainService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  private readonly logger = new Logger(
    'coupon:' + OnOrderProcessingListener.name,
  );

  @OnEvent(OrderProcessingEvent.EVENT_NAME)
  async handleUseUserCouponByOrder(
    event: OrderProcessingEvent,
  ): Promise<UseUserCouponByOrderResult> {
    const { orderId, userId, couponId } = event;

    try {
      // 쿠폰 미적용 시 바로 성공 반환
      if (!couponId) {
        return {
          listenerName: 'UseUserCouponByOrder',
        };
      }

      // Redis에서 쿠폰 사용 처리
      this.logger.log(
        `[onOrderProcessing] 쿠폰 사용 처리 시작 - orderId: ${orderId}, userId: ${userId}, couponId: ${couponId}`,
      );
      const coupon = await this.couponRedisService.getCachedCoupon(couponId); // or throw
      const userCoupon = await this.couponRedisService.useUserCoupon(
        userId,
        coupon.id,
        orderId,
      ); // or throw

      // Redis -> DB에 동기화 (정산용)
      await this.couponService.createUserCoupon(userCoupon);

      this.logger.log(
        `[onOrderProcessing] 쿠폰 사용 처리 성공 - orderId: ${orderId}, userId: ${userId}, couponId: ${couponId}`,
      );

      return {
        listenerName: 'UseUserCouponByOrder',
        coupon: coupon,
        userCoupon: userCoupon,
      };
    } catch (error) {
      this.logger.error(
        `[onOrderProcessing] 쿠폰 사용 처리 실패 - orderId: ${orderId}, userId: ${userId}, couponId: ${couponId}, error: ${error}`,
      );

      // 쿠폰 사용 처리 실패시 레디스 롤백 (자체 롤백)
      if (couponId) {
        await this.couponRedisService.cancelCouponUse(
          userId,
          couponId,
          orderId,
        );
      }

      // order.processing.fail 이벤트 발행 (다른 리스너들의 보상 트랜잭션 트리거) - 동기적으로 완료 대기
      await this.eventEmitter.emitAsync(
        OrderProcessingFailEvent.EVENT_NAME,
        new OrderProcessingFailEvent(
          orderId,
          userId,
          couponId,
          event.order,
          event.orderItems,
          'UseUserCouponByOrder',
          error,
        ),
      );

      return {
        listenerName: 'UseUserCouponByOrder',
        error: error as Error,
      };
    }
  }
}

export interface UseUserCouponByOrderResult {
  listenerName: 'UseUserCouponByOrder';
  coupon?: Coupon | null;
  userCoupon?: UserCoupon | null;
  error?: Error;
}
