import { OrderItem } from '@/order/domain/entities/order-item.entity';
import { Order } from '@/order/domain/entities/order.entity';

export type AppliedCouponInfo = {
  id: number;
  discountRate: number;
};

/**
 * 주문 처리 성공 이벤트
 *
 * 이벤트명: order.processing.success
 * 발행: OrderProcessingFlowListener
 * 구독: onOrderProcessingSuccess (쿠폰을 주문에 반영 후 결제 이벤트 발행)
 */
export class OrderProcessingSuccessEvent {
  static readonly EVENT_NAME = 'order.processing.success';

  constructor(
    public readonly orderId: number,
    public readonly userId: number,
    public readonly couponId: number | null,
    public readonly order: Order,
    public readonly orderItems: OrderItem[],
    public readonly appliedCoupon: AppliedCouponInfo | null,
  ) {}
}
