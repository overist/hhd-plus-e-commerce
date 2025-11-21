import { Injectable } from '@nestjs/common';
import {
  IOrderItemRepository,
  IOrderRepository,
} from '@domain/interfaces/order.repository.interface';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrderStatus } from './order-status.vo';
import { OrderItemData } from './order.types';
import { ValidationException } from '@domain/common/exceptions/domain.exception';
import { ErrorCode } from '@domain/common/constants/error-code';

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
      throw new ValidationException(ErrorCode.ORDER_NOT_FOUND);
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
}
