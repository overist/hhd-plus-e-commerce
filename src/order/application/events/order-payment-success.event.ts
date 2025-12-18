import { OrderItem } from '@/order/domain/entities/order-item.entity';
import { Order } from '@/order/domain/entities/order.entity';

/**
 * 주문 결제 성공 이벤트
 *
 * 이벤트명: order.payment.success
 * 발행: OnOrderPaymentListener (user 모듈)
 * 구독: onOrderPaymentSuccess (주문 PAID 처리 후 order.processed 발행)
 */
export class OrderPaymentSuccessEvent {
  static readonly EVENT_NAME = 'order.payment.success';

  constructor(
    public readonly orderId: number,
    public readonly userId: number,
    public readonly couponId: number | null,
    public readonly order: Order,
    public readonly orderItems: OrderItem[],
  ) {}
}
