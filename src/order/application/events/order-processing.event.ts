import { OrderItem } from '@/order/domain/entities/order-item.entity';
import { Order } from '@/order/domain/entities/order.entity';

/**
 * 주문 결제 완료 이벤트
 *
 * 이벤트명: order.processing
 * 발행: ProcessPaymentUseCase
 * 구독: onOrderProcessing (쿠폰 사용, 재고 확정 차감)
 */
export class OrderProcessingEvent {
  static readonly EVENT_NAME = 'order.processing';

  constructor(
    public readonly orderId: number,
    public readonly userId: number,
    public readonly couponId: number | null,
    public readonly order: Order,
    public readonly orderItems: OrderItem[],
  ) {}
}
