// core
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

// event
import { OrderProcessingEvent } from '@/order/application/events/order-processing.event';

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
 * 실패: order.processing.fail
 */
@Injectable()
export class OnOrderProcessingListener {
  constructor(
    private readonly couponRedisService: CouponRedisService,
    private readonly couponService: CouponDomainService,
  ) {}
  private readonly logger = new Logger(OnOrderProcessingListener.name);

  @OnEvent(OrderProcessingEvent.EVENT_NAME)
  async handleUseUserCouponByOrder(
    event: OrderProcessingEvent,
  ): Promise<UseUserCouponByOrderResult> {
    const { orderId, userId, couponId, order, orderItems } = event;

    try {
      // 쿠폰 미적용 시 바로 성공 반환
      if (!couponId) {
        return {
          listenerName: 'UseUserCouponByOrder',
          success: true,
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
        success: true,
        coupon: coupon,
        userCoupon: userCoupon,
      };
    } catch (error) {
      this.logger.error(
        `[onOrderProcessing] 쿠폰 사용 처리 실패 - orderId: ${orderId}, userId: ${userId}, couponId: ${couponId}, error: ${error}`,
      );

      // 쿠폰 사용 처리 실패시 레디스 롤백
      if (couponId)
        await this.couponRedisService.cancelCouponUse(userId, couponId);

      return {
        listenerName: 'UseUserCouponByOrder',
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

export interface UseUserCouponByOrderResult {
  listenerName: 'UseUserCouponByOrder';
  success: boolean;
  error?: Error;
  coupon?: Coupon | null;
  userCoupon?: UserCoupon | null;
}
