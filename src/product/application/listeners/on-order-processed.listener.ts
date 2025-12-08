import { ProductDomainService } from '@/product/domain/services/product.service';
import { UserBalanceDeductByOrderEvent } from '@/user/application/events/user-balance-deduct-by-order.event';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

/**
 * onOrderProcessed - 주문 결제 완료 시 인기상품 판매 집계
 *
 * 수신: order.processed
 * 동작: Redis에 판매 랭킹 비동기 기록
 */
@Injectable()
export class OnOrderProcessedListener {
  constructor(private readonly productService: ProductDomainService) {}
  private readonly logger = new Logger(
    'product:' + OnOrderProcessedListener.name,
  );

  @OnEvent(UserBalanceDeductByOrderEvent.EVENT_NAME)
  async handle(event: UserBalanceDeductByOrderEvent): Promise<void> {
    try {
      // 판매 랭킹 업데이트 (Redis) fire and forget
      this.productService.recordSales(event.orderItems);

      this.logger.log(
        `[onUserBalanceDeductByOrder] 판매 랭킹 업데이트 완료 - orderId: ${event.order.id}`,
      );
    } catch (error) {
      // 판매 랭킹 업데이트 실패는 결제에 아무 영향을 주지 않음
      this.logger.error(
        `[onUserBalanceDeductByOrder] 판매 랭킹 업데이트 실패 - orderId: ${event.order.id}`,
        error,
      );
    }
  }
}
