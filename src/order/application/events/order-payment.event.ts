import { OrderItem } from '@/order/domain/entities/order-item.entity';
import { Order } from '@/order/domain/entities/order.entity';

/**
 * 주문 결제 완료 이벤트
 *
 * 이벤트명: order.payment
 * 발행: ProcessPaymentUseCase
 * 구독: onOrderPayment (잔액 차감)
 */
export class OrderPaymentEvent {
  static readonly EVENT_NAME = 'order.payment';

  constructor(
    public readonly orderId: number,
    public readonly userId: number,
    public readonly couponId: number | null,
    public readonly order: Order,
    public readonly orderItems: OrderItem[],
  ) {}
}
