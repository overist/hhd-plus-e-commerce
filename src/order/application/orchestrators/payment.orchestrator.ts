import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

// events
import { OrderProcessingEvent } from '../events/order-processing.event';
import { OrderPaymentEvent } from '../events/order-payment.event';
import { OrderProcessedEvent } from '../events/order-processed.event';

// listener results
import { UseUserCouponByOrderResult } from '@/coupon/application/listeners/on-order-processing.listener';
import { ConfirmStockByOrderResult } from '@/product/application/listeners/on-order-processing.listener';
import { UserBalanceDeductByOrderResult } from '@/user/application/listeners/on-order-payment.listener';

// domain
import { Order } from '@/order/domain/entities/order.entity';
import { OrderItem } from '@/order/domain/entities/order-item.entity';
import { User } from '@/user/domain/entities/user.entity';
import { Coupon } from '@/coupon/domain/entities/coupon.entity';

/**
 * 결제 오케스트레이션 결과
 */
export interface PaymentOrchestrationResult {
  user: User;
}

/**
 * PaymentOrchestrator
 *
 * 결제 프로세스의 이벤트 흐름을 제어하는 오케스트레이션 레이어
 * - UseCase와 분리하여 "이벤트 순서 제어" 역할만 담당
 * - 각 단계별 이벤트 발행 및 결과 검증
 * - 실패 시 보상 트랜잭션 트리거 (리스너가 *.fail 이벤트 발행)
 */
@Injectable()
export class PaymentOrchestrator {
  private readonly logger = new Logger(PaymentOrchestrator.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * 결제 오케스트레이션 실행
   *
   * 이벤트 흐름:
   * 1. order.processing → 재고 확정, 쿠폰 사용 (실패 시 order.processing.fail)
   * 2. 쿠폰 적용 → order 객체에 할인율 반영 (finalAmount 계산)
   * 3. order.payment → 잔액 차감 (실패 시 order.payment.fail)
   * 4. order.processed → 외부 플랫폼 전송, 인기상품 집계 (Fire & Forget)
   */
  async runOrderProcess(
    orderId: number,
    userId: number,
    couponId: number | null,
    order: Order,
    orderItems: OrderItem[],
  ): Promise<PaymentOrchestrationResult> {
    // 1단계: order.processing 이벤트 발행 (재고 확정 + 쿠폰 사용)
    const coupon = await this.processOrderProcessing(
      orderId,
      userId,
      couponId,
      order,
      orderItems,
    );

    // 2단계: 쿠폰 적용 (잔액 차감 전에 finalAmount 계산)
    if (coupon) {
      order.applyCoupon(coupon.id, coupon.discountRate);
    }

    // 3단계: order.payment 이벤트 발행
    const user = await this.processOrderPayment(
      orderId,
      userId,
      couponId,
      order,
      orderItems,
    );

    // 4단계: order.processed 이벤트 발행 (Fire & Forget)
    this.emitOrderProcessed(orderId, userId, couponId, order, orderItems);

    return { user };
  }

  /**
   * 1단계: order.processing
   * - 재고 확정 차감 (ConfirmStockByOrder)
   * - 쿠폰 사용 처리 (UseUserCouponByOrder)
   */
  private async processOrderProcessing(
    orderId: number,
    userId: number,
    couponId: number | null,
    order: Order,
    orderItems: OrderItem[],
  ): Promise<Coupon | null> {
    this.logger.log(
      `[오케스트레이션] order.processing 시작 - orderId: ${orderId}`,
    );

    const processingResults = await this.eventEmitter.emitAsync(
      OrderProcessingEvent.EVENT_NAME,
      new OrderProcessingEvent(orderId, userId, couponId, order, orderItems),
    );

    // 재고 확정 결과 검증
    const stockResult = processingResults.find(
      (res) => res?.listenerName === 'ConfirmStockByOrder' && res.error,
    ) as ConfirmStockByOrderResult | undefined;
    if (stockResult) {
      throw stockResult.error;
    }

    // 쿠폰 사용 결과 검증
    const couponResult = processingResults.find(
      (res) => res?.listenerName === 'UseUserCouponByOrder',
    ) as UseUserCouponByOrderResult | undefined;
    if (couponResult?.error) {
      throw couponResult.error;
    }

    this.logger.log(
      `[오케스트레이션] order.processing 완료 - orderId: ${orderId}`,
    );
    return couponResult?.coupon || null;
  }

  /**
   * 2단계: order.payment
   * - 잔액 차감 (UserBalanceDeductByOrder)
   */
  private async processOrderPayment(
    orderId: number,
    userId: number,
    couponId: number | null,
    order: Order,
    orderItems: OrderItem[],
  ): Promise<User> {
    this.logger.log(
      `[오케스트레이션] order.payment 시작 - orderId: ${orderId}`,
    );

    const paymentResults = await this.eventEmitter.emitAsync(
      OrderPaymentEvent.EVENT_NAME,
      new OrderPaymentEvent(orderId, userId, couponId, order, orderItems),
    );

    // 잔액 차감 결과 검증
    const balanceResult = paymentResults.find(
      (res) => res?.listenerName === 'UserBalanceDeductByOrder',
    ) as UserBalanceDeductByOrderResult | undefined;
    if (balanceResult?.error) {
      throw balanceResult.error;
    }

    this.logger.log(
      `[오케스트레이션] order.payment 완료 - orderId: ${orderId}`,
    );
    return balanceResult!.user!;
  }

  /**
   * 3단계: order.processed (Fire & Forget)
   * - 외부 플랫폼 전송
   * - 인기상품 집계
   */
  private emitOrderProcessed(
    orderId: number,
    userId: number,
    couponId: number | null,
    order: Order,
    orderItems: OrderItem[],
  ): void {
    this.logger.log(
      `[오케스트레이션] order.processed 발행 - orderId: ${orderId}`,
    );

    this.eventEmitter.emit(
      OrderProcessedEvent.EVENT_NAME,
      new OrderProcessedEvent(orderId, userId, couponId, order, orderItems),
    );
  }
}
