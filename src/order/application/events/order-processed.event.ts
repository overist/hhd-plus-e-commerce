import { OrderItem } from '@/order/domain/entities/order-item.entity';
import { Order } from '@/order/domain/entities/order.entity';

/**
 * 주문 결제 완료 이벤트
 *
 * 이벤트명: order.proceed
 * 발행: ProcessPaymentUseCase (주문 결제 처리 완료 시)
 * 구독: onOrderProcessed (데이터 플랫폼 전송, 인기 상품 집계)
 */
export class OrderProcessedEvent {
  static readonly EVENT_NAME = 'order.processed';

  constructor(
    public readonly orderId: number,
    public readonly userId: number,
    public readonly couponId: number | null,
    public readonly order: Order,
    public readonly orderItems: OrderItem[],
  ) {}
}
