import { OrderItem } from '@/order/domain/entities/order-item.entity';
import { Order } from '@/order/domain/entities/order.entity';

/**
 * 주문 처리 성공 이벤트 (재고 확정)
 *
 * 이벤트명: order.processing.stock.success
 * 발행: product OnOrderProcessingListener
 */
export class OrderProcessingStockSuccessEvent {
  static readonly EVENT_NAME = 'order.processing.stock.success';

  constructor(
    public readonly orderId: number,
    public readonly userId: number,
    public readonly couponId: number | null,
    public readonly order: Order,
    public readonly orderItems: OrderItem[],
  ) {}
}
