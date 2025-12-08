import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderDomainService } from '@/order/domain/services/order.service';

// dto
import {
  ProcessPaymentCommand,
  ProcessPaymentResult,
} from './dto/process-payment.dto';

// event
import { OrderProcessingEvent } from './events/order-processing.event';
import { OrderProcessedEvent } from './events/order-processed.event';
import { UseUserCouponByOrderResult } from '@/coupon/application/listeners/on-order-processing.listener';
import { OrderPaymentEvent } from './events/order-payment.event';
import { UserBalanceDeductByOrderResult } from '@/user/application/listeners/on-order-payment.listener';

@Injectable()
export class ProcessPaymentUseCase {
  private readonly logger = new Logger(ProcessPaymentUseCase.name);

  constructor(
    private readonly orderService: OrderDomainService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * ANCHOR 결제 처리
   * Redis를 활용한 쿠폰 사용 + 트랜잭션으로 결제 처리 + 재고 확정을 처리
   */
  async processPayment(
    cmd: ProcessPaymentCommand,
  ): Promise<ProcessPaymentResult> {
    try {
      // 0단계: 주문 조회 / 상태 변경
      const order = await this.orderService.getOrder(cmd.orderId);
      const orderItems = await this.orderService.getOrderItems(cmd.orderId);
      order.validateOwnedBy(cmd.userId);
      order.pay(); // 상태변경

      /**
       * 1단계: order.processing 이벤트 발행
       * 후속 처리: ConfirmStockByOrder - 재고 확정 차감
       *            UseUserCouponByOrder - 쿠폰 사용 처리
       */
      const event1 = OrderProcessingEvent.EVENT_NAME;
      const payload1 = new OrderProcessingEvent(
        cmd.orderId,
        cmd.userId,
        cmd.couponId || null,
        order,
        orderItems,
      );
      const event1Results = await this.eventEmitter.emitAsync(event1, payload1);

      // 이벤트리스너의 쿠폰 사용 결과 반영
      const couponResult = event1Results.find(
        (res) => res.listenerName === 'UseUserCouponByOrder',
      ) as UseUserCouponByOrderResult;
      // success & exists
      if (couponResult && couponResult.coupon) {
        const id = couponResult.coupon.id;
        const rate = couponResult.coupon.discountRate;
        order.applyCoupon(id, rate);
      }
      // fail
      if (couponResult.error) {
        throw couponResult.error; // 도메인 예외 발생시 처리
      }
      await this.orderService.updateOrder(order);

      /**
       * 2단계: order.payment 이벤트 발행
       * 후속 처리: UserBalanceDeductByOrder - 유저 잔액 차감
       */
      const event2 = OrderPaymentEvent.EVENT_NAME;
      const payload2 = new OrderPaymentEvent(
        cmd.orderId,
        cmd.userId,
        cmd.couponId || null,
        order,
        orderItems,
      );
      const event2Results = await this.eventEmitter.emitAsync(event2, payload2);

      // 이벤트리스너의 유저 잔액 차감 결과 반영
      const balanceResult = event2Results.find(
        (res) => res.listenerName === 'UserBalanceDeductResult',
      ) as UserBalanceDeductByOrderResult;
      if (balanceResult.error) {
        throw balanceResult.error; // 도메인 예외 발생시 처리
      }
      const user = balanceResult.user!;

      /**
       * 3단계: 종료 이벤트 발행: 주문 처리 완료 이벤트 (order.processed)
       * 후속 처리: 외부 플랫폼 전송, 인기상품 집계
       */
      const event3 = OrderProcessedEvent.EVENT_NAME;
      const payload3 = new OrderProcessedEvent(
        cmd.orderId,
        cmd.userId,
        cmd.couponId || null,
        order,
        orderItems,
      );
      this.eventEmitter.emit(event3, payload3);

      // 최종 결과 반환
      const result = ProcessPaymentResult.from(order, user);
      return result;
    } catch (error) {
      this.logger.error(
        `[ProcessPaymentUseCase] 결제 처리 실패 - orderId: ${cmd.orderId}, userId: ${cmd.userId}`,
        error,
      );
      throw error;
    }
  }
}
