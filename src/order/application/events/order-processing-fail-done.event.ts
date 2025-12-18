/**
 * 주문 처리(order.processing) 실패 보상 트랜잭션 완료 이벤트
 *
 * 이벤트명: order.processing.fail.done
 * 발행: order/product/coupon 보상 리스너
 */
export class OrderProcessingFailDoneEvent {
  static readonly EVENT_NAME = 'order.processing.fail.done';

  constructor(
    public readonly orderId: number,
    public readonly handlerName: 'order' | 'product' | 'coupon',
  ) {}
}
