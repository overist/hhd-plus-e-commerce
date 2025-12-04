import { Injectable } from '@nestjs/common';
import {
  IOrderItemRepository,
  IOrderRepository,
} from '@/order/domain/interfaces/order.repository.interface';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatus } from '../entities/order-status.vo';
import { OrderItemData } from '../entities/order.types';
import { ErrorCode, DomainException } from '@common/exception';

/**
 * OrderDomainService
 * 주문 관련 영속성 계층과 상호작용하며 핵심 비즈니스 로직을 담당한다.
 */
@Injectable()
export class OrderDomainService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly orderItemRepository: IOrderItemRepository,
  ) {}

  /**
   * ANCHOR 주문서 생성
   */
  async createOrder(order: Order): Promise<Order> {
    const createdOrder = await this.orderRepository.create(order);
    return createdOrder;
  }

  /**
   * ANCHOR 주문 아이템 생성
   */
  async createOrderItem(orderItem: OrderItem): Promise<OrderItem> {
    const createdOrderItem = await this.orderItemRepository.create(orderItem);
    return createdOrderItem;
  }

  /**
   * ANCHOR 주문 아이템 일괄 생성
   */
  async createOrderItems(
    orderId: number,
    itemsData: OrderItemData[],
  ): Promise<OrderItem[]> {
    const now = new Date();
    const orderItems = itemsData.map(
      (data) =>
        new OrderItem(
          0,
          orderId,
          data.productOptionId,
          data.productName,
          data.price,
          data.quantity,
          data.price * data.quantity,
          now,
        ),
    );
    return await this.orderItemRepository.createMany(orderItems);
  }

  /**
   * ANCHOR 주문 엔티티 생성 (10분 후 만료)
   */
  async createPendingOrder(
    userId: number,
    totalAmount: number,
  ): Promise<Order> {
    const now = new Date();
    const expiredAt = new Date(now.getTime() + 10 * 60 * 1000);

    const order = new Order(
      0,
      userId,
      null,
      totalAmount,
      0,
      totalAmount,
      OrderStatus.PENDING,
      now,
      null,
      expiredAt,
      now,
    );
    return await this.orderRepository.create(order);
  }

  /**
   * ANCHOR 주문 업데이트
   */
  async updateOrder(order: Order): Promise<Order> {
    return await this.orderRepository.update(order);
  }

  /**
   * ANCHOR 주문 조회
   */
  async getOrder(orderId: number): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new DomainException(ErrorCode.ORDER_NOT_FOUND);
    }
    return order;
  }

  /**
   * ANCHOR 주문 아이템 조회
   */
  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    const items = await this.orderItemRepository.findManyByOrderId(orderId);
    return items;
  }

  /**
   * ANCHOR 사용자 주문 목록 조회
   */
  async getOrders(userId: number): Promise<Order[]> {
    const orders = await this.orderRepository.findManyByUserId(userId);
    return orders;
  }

  /**
   * ANCHOR 인기상품 랭킹 집계
   */
  recordSales(orderItems: OrderItem[]): void {
    this.orderItemRepository.recordSales(orderItems);
  }

  /**
   * ANCHOR N일간 인기상품 랭킹 조회
   */
  async getSalesRankingDays(
    count: number,
    days: number = 3,
  ): Promise<Array<{ productOptionId: number; salesCount: number }>> {
    const MAX_DATE_RANGE_DAYS = 30;
    if (days <= 0 || days > MAX_DATE_RANGE_DAYS) {
      throw new DomainException(ErrorCode.INVALID_ARGUMENT);
    }

    const aggregateMap: Map<number, number> = new Map();

    // dateRangeDays 일 수만큼 반복하여 각 날짜의 랭킹 조회
    const rankPromises: Promise<
      Array<{ productOptionId: number; salesCount: number }>
    >[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const YYYYMMDD = date.toISOString().split('T')[0].replace(/-/g, '');
      rankPromises.push(this.orderItemRepository.findRankByDate(YYYYMMDD));
    }

    const ranks = await Promise.all(rankPromises);

    // 모든 랭킹 데이터 집계
    for (const rank of ranks) {
      for (const { productOptionId, salesCount } of rank) {
        const currentCount = aggregateMap.get(productOptionId) || 0;
        aggregateMap.set(productOptionId, currentCount + salesCount);
      }
    }

    const aggregatedRanks = Array.from(aggregateMap.entries()).map(
      ([productOptionId, salesCount]) => ({ productOptionId, salesCount }),
    );

    aggregatedRanks.sort((a, b) => b.salesCount - a.salesCount);

    return aggregatedRanks.slice(0, count);
  }
}
