import { OrderItem } from '@/order/domain/entities/order-item.entity';
import { Order } from '@/order/domain/entities/order.entity';

/**
 * 주문 결제 실패 이벤트 (보상 트랜잭션용)
 *
 * 이벤트명: order.payment.fail
 * 발행: ProcessPaymentUseCase (order.payment 이벤트 처리 중 실패 시)
 * 구독: 쿠폰 롤백, 재고 롤백 (order.processing에서 처리된 것들 롤백)
 */
export class OrderPaymentFailEvent {
  static readonly EVENT_NAME = 'order.payment.fail';

  constructor(
    public readonly orderId: number,
    public readonly userId: number,
    public readonly couponId: number | null,
    public readonly order: Order,
    public readonly orderItems: OrderItem[],
    public readonly failedListenerName: string,
    public readonly error: Error,
  ) {}
}
