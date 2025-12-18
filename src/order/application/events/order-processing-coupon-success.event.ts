import { OrderItem } from '@/order/domain/entities/order-item.entity';
import { Order } from '@/order/domain/entities/order.entity';

export type AppliedCouponInfo = {
  id: number;
  discountRate: number;
};

/**
 * 주문 처리 성공 이벤트 (쿠폰 사용)
 *
 * 이벤트명: order.processing.coupon.success
 * 발행: coupon OnOrderProcessingListener
 */
export class OrderProcessingCouponSuccessEvent {
  static readonly EVENT_NAME = 'order.processing.coupon.success';

  constructor(
    public readonly orderId: number,
    public readonly userId: number,
    public readonly couponId: number,
    public readonly order: Order,
    public readonly orderItems: OrderItem[],
    public readonly appliedCoupon: AppliedCouponInfo,
  ) {}
}
