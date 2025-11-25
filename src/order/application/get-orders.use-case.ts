import { Injectable } from '@nestjs/common';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { GetOrdersQuery, GetOrdersResult } from './dto/get-orders.dto';

@Injectable()
export class GetOrdersUseCase {
  constructor(private readonly orderService: OrderDomainService) {}

  /**
   * ANCHOR 주문 내역 조회
   */
  async execute(query: GetOrdersQuery): Promise<GetOrdersResult[]> {
    const orders = await this.orderService.getOrders(query.userId);

    return orders.map((order) => GetOrdersResult.fromDomain(order));
  }
}
