import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { RedisLockService } from '@common/redis-lock-manager/redis.lock.service';

// dto
import {
  ProcessPaymentCommand,
  ProcessPaymentResult,
} from './dto/process-payment.dto';

// event
import { OrderProcessingEvent } from './events/order-processing.event';
import { OrderProcessedEvent } from './events/order-processed.event';
import { OrderPaymentEvent } from './events/order-payment.event';
import { UseUserCouponByOrderResult } from '@/coupon/application/listeners/on-order-processing.listener';
import { ConfirmStockByOrderResult } from '@/product/application/listeners/on-order-processing.listener';
import { UserBalanceDeductByOrderResult } from '@/user/application/listeners/on-order-payment.listener';

@Injectable()
export class ProcessPaymentUseCase {
  private readonly logger = new Logger(ProcessPaymentUseCase.name);

  constructor(
    private readonly orderService: OrderDomainService,
    private readonly eventEmitter: EventEmitter2,
    private readonly redisLockService: RedisLockService,
  ) {}

  /**
   * ANCHOR 결제 처리
   * Redis를 활용한 쿠폰 사용 + 트랜잭션으로 결제 처리 + 재고 확정을 처리
   *
   * 이벤트 흐름:
   * 1. order.processing → 재고 확정, 쿠폰 사용 (실패 시 리스너가 order.processing.fail 발행)
   * 2. order.payment → 잔액 차감 (실패 시 리스너가 order.payment.fail 발행)
   * 3. order.processed → 외부 플랫폼 전송, 인기상품 집계
   *
   * 동시성 제어:
   * - payment:order:{orderId} - 동일 주문에 대한 중복 결제 방지 (Redis 분산락)
   * - 상품 옵션별 재고 (DB 비관적 잠금 FOR UPDATE)
   * - 사용자별 잔액 (DB 낙관적 잠금 + 재시도)
   * - 쿠폰 - Redis Lua 스크립트로 원자적 처리 (CouponRedisService)
   */
  async processPayment(
    cmd: ProcessPaymentCommand,
  ): Promise<ProcessPaymentResult> {
    const lockKey = `payment:order:${cmd.orderId}`;
    return this.redisLockService.withLock(
      lockKey,
      async () => {
        // 0단계: 주문 조회 / 상태 변경
        const order = await this.orderService.getOrder(cmd.orderId);
        const orderItems = await this.orderService.getOrderItems(cmd.orderId);
        order.validateOwnedBy(cmd.userId);
        order.pay(); // 상태변경

        /**
         * 1단계: order.processing 이벤트 발행
         * 후속 처리: ConfirmStockByOrder - 재고 확정 차감
         *            UseUserCouponByOrder - 쿠폰 사용 처리
         * 실패 시: 리스너가 order.processing.fail 발행 후 error 객체 리턴
         */
        const processingResults = await this.eventEmitter.emitAsync(
          OrderProcessingEvent.EVENT_NAME,
          new OrderProcessingEvent(
            cmd.orderId,
            cmd.userId,
            cmd.couponId || null,
            order,
            orderItems,
          ),
        );

        // 주문 처리 상태 검증
        const ConfirmStockResult = processingResults.find(
          (res) => res?.listenerName === 'ConfirmStockByOrder' && res.error,
        ) as ConfirmStockByOrderResult | undefined;
        if (ConfirmStockResult) {
          throw ConfirmStockResult.error; // Exception 전파
        }

        // 쿠폰 사용처리 상태 검증
        const couponResult = processingResults.find(
          (res) => res?.listenerName === 'UseUserCouponByOrder',
        ) as UseUserCouponByOrderResult | undefined;
        if (couponResult?.error) {
          throw couponResult.error; // Exception 전파
        }

        // 주문에 쿠폰 적용
        if (couponResult?.coupon) {
          order.applyCoupon(
            couponResult.coupon.id,
            couponResult.coupon.discountRate,
          );
        }
        await this.orderService.updateOrder(order);

        /**
         * 2단계: order.payment 이벤트 발행
         * 후속 처리: UserBalanceDeductByOrder - 유저 잔액 차감
         * 실패 시: 리스너가 order.payment.fail 발행 후 error 객체 리턴
         */
        const paymentResults = await this.eventEmitter.emitAsync(
          OrderPaymentEvent.EVENT_NAME,
          new OrderPaymentEvent(
            cmd.orderId,
            cmd.userId,
            cmd.couponId || null,
            order,
            orderItems,
          ),
        );
        const balanceResult = paymentResults.find(
          (res) => res?.listenerName === 'UserBalanceDeductByOrder',
        ) as UserBalanceDeductByOrderResult | undefined;
        if (balanceResult?.error) {
          throw balanceResult.error; // Exception 전파
        }

        /**
         * 3단계: 종료 이벤트 발행: 주문 처리 완료 이벤트 (order.processed)
         * 후속 처리: 외부 플랫폼 전송, 인기상품 집계
         */
        this.eventEmitter.emit(
          OrderProcessedEvent.EVENT_NAME,
          new OrderProcessedEvent(
            cmd.orderId,
            cmd.userId,
            cmd.couponId || null,
            order,
            orderItems,
          ),
        );

        return ProcessPaymentResult.from(order, balanceResult!.user!);
      },
      { ttl: 10000 },
    );
  }
}
