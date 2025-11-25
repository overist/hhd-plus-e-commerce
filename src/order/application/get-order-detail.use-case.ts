import { Injectable } from '@nestjs/common';
import { OrderDomainService } from '@/order/domain/services/order.service';
import {
  GetOrderDetailQuery,
  GetOrderDetailResult,
} from './dto/get-order-detail.dto';

@Injectable()
export class GetOrderDetailUseCase {
  constructor(private readonly orderService: OrderDomainService) {}

  /**
   * ANCHOR 주문 상세 조회
   */
  async execute(query: GetOrderDetailQuery): Promise<GetOrderDetailResult> {
    const order = await this.orderService.getOrder(query.orderId);
    const items = await this.orderService.getOrderItems(query.orderId);

    return GetOrderDetailResult.fromDomain(order, items);
  }
}
