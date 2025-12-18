import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';

import { OrderProcessingEvent } from '@/order/application/events/order-processing.event';
import { OrderProcessingStockSuccessEvent } from '@/order/application/events/order-processing-stock-success.event';
import { OrderProcessingCouponSuccessEvent } from '@/order/application/events/order-processing-coupon-success.event';
import { OrderProcessingFailEvent } from '@/order/application/events/order-processing-fail.event';
import { OrderProcessingSuccessEvent } from '@/order/application/events/order-processing-success.event';
import { AppliedCouponInfo } from '@/order/application/events/order-processing-success.event';

/**
 * order.processing 코디네이터
 * - 재고/쿠폰 리스너가 각각 처리
 * - 둘 다 성공하면 order.processing.success로 다음 단계 진행
 */
@Injectable()
export class OnOrderProcessingListener {
  private readonly logger = new Logger(
    'order:' + OnOrderProcessingListener.name,
  );

  private readonly stateByOrderId = new Map<
    number,
    {
      orderId: number;
      userId: number;
      couponId: number | null;
      order: OrderProcessingEvent['order'];
      orderItems: OrderProcessingEvent['orderItems'];
      stockOk: boolean;
      couponOk: boolean;
      appliedCoupon: AppliedCouponInfo | null;
    }
  >();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @OnEvent(OrderProcessingEvent.EVENT_NAME)
  async handle(event: OrderProcessingEvent): Promise<void> {
    // 초기 상태 등록 (쿠폰 미적용이면 couponOk=true로 간주)
    this.stateByOrderId.set(event.orderId, {
      orderId: event.orderId,
      userId: event.userId,
      couponId: event.couponId,
      order: event.order,
      orderItems: event.orderItems,
      stockOk: false,
      couponOk: event.couponId ? false : true,
      appliedCoupon: null,
    });

    this.logger.log(
      `[order.processing] coordinator init - orderId: ${event.orderId}, couponId: ${event.couponId ?? 'none'}`,
    );
  }

  @OnEvent(OrderProcessingStockSuccessEvent.EVENT_NAME)
  async handleStockSuccess(
    event: OrderProcessingStockSuccessEvent,
  ): Promise<void> {
    const state = this.ensureState(event);
    state.stockOk = true;
    this.tryEmitSuccess(state);
  }

  @OnEvent(OrderProcessingCouponSuccessEvent.EVENT_NAME)
  async handleCouponSuccess(
    event: OrderProcessingCouponSuccessEvent,
  ): Promise<void> {
    const state = this.ensureState(event);
    state.couponOk = true;
    state.appliedCoupon = event.appliedCoupon;
    this.tryEmitSuccess(state);
  }

  @OnEvent(OrderProcessingFailEvent.EVENT_NAME)
  async handleFail(event: OrderProcessingFailEvent): Promise<void> {
    this.stateByOrderId.delete(event.orderId);
  }

  private ensureState(
    event: OrderProcessingStockSuccessEvent | OrderProcessingCouponSuccessEvent,
  ) {
    const existing = this.stateByOrderId.get(event.orderId);
    if (existing) {
      return existing;
    }

    const created = {
      orderId: event.orderId,
      userId: event.userId,
      couponId: event.couponId,
      order: event.order,
      orderItems: event.orderItems,
      stockOk: false,
      couponOk: event.couponId ? false : true,
      appliedCoupon: null,
    };
    this.stateByOrderId.set(event.orderId, created);
    return created;
  }

  private tryEmitSuccess(state: {
    orderId: number;
    userId: number;
    couponId: number | null;
    order: OrderProcessingEvent['order'];
    orderItems: OrderProcessingEvent['orderItems'];
    stockOk: boolean;
    couponOk: boolean;
    appliedCoupon: AppliedCouponInfo | null;
  }): void {
    if (!state.stockOk) return;
    if (!state.couponOk) return;

    this.stateByOrderId.delete(state.orderId);

    this.logger.log(
      `[order.processing] coordinator success - orderId: ${state.orderId}`,
    );

    this.eventEmitter.emit(
      OrderProcessingSuccessEvent.EVENT_NAME,
      new OrderProcessingSuccessEvent(
        state.orderId,
        state.userId,
        state.couponId,
        state.order,
        state.orderItems,
        state.appliedCoupon,
      ),
    );
  }
}
