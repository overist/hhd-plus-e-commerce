/**
 * 결제(order.payment) 실패 보상 트랜잭션 완료 이벤트
 *
 * 이벤트명: order.payment.fail.done
 * 발행: order/product/coupon 보상 리스너
 */
export class OrderPaymentFailDoneEvent {
  static readonly EVENT_NAME = 'order.payment.fail.done';

  constructor(
    public readonly orderId: number,
    public readonly handlerName: 'order' | 'product' | 'coupon',
  ) {}
}
