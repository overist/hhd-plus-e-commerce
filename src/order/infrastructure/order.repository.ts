import { Injectable } from '@nestjs/common';
import { order_items, orders, Prisma } from '@prisma/client';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import {
  IOrderItemRepository,
  IOrderRepository,
} from '../domain/interfaces/order.repository.interface';
import { Order } from '@/order/domain/entities/order.entity';
import { OrderItem } from '@/order/domain/entities/order-item.entity';
import { OrderStatus } from '@/order/domain/entities/order-status.vo';

/**
 * Order Repository Implementation (Prisma)
 */
@Injectable()
export class OrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get prismaClient(): Prisma.TransactionClient | PrismaService {
    return this.prisma.getClient();
  }

  // ANCHOR findById
  async findById(id: number): Promise<Order | null> {
    const tx = this.prisma.getTransactionClient();

    // 트랜잭션 컨텍스트가 있으면 FOR UPDATE 사용
    if (tx) {
      const recordList: orders[] =
        await tx.$queryRaw`SELECT * FROM orders WHERE id = ${id} FOR UPDATE`;
      const record = recordList.length > 0 ? recordList[0] : null;
      return record ? this.mapToDomain(record) : null;
    }

    // 트랜잭션 컨텍스트가 없으면 일반 조회
    const record = await this.prismaClient.orders.findUnique({
      where: { id },
    });
    return record ? this.mapToDomain(record) : null;
  }

  // ANCHOR findManyByUserId
  /**
   * TODO: [성능 개선 필요] ORDER BY 최적화
   * 현재 상태: WHERE user_id = ? ORDER BY created_at DESC
   *
   * 개선 방안:
   * 1. 복합 인덱스 추가: (user_id, created_at DESC)
   *    - 현재는 user_id 단일 인덱스만 존재
   *    - Covering Index로 설계하면 인덱스만으로 쿼리 완결 가능
   * 2. 인덱스 생성 쿼리:
   *    CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
   *
   * 예상 효과:
   * - 정렬을 위한 filesort 연산 제거
   * - 인덱스 스캔만으로 결과 반환
   */
  async findManyByUserId(userId: number): Promise<Order[]> {
    const records = await this.prismaClient.orders.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
    return records.map((record) => this.mapToDomain(record));
  }

  // ANCHOR create
  async create(order: Order): Promise<Order> {
    const created = await this.prismaClient.orders.create({
      data: {
        user_id: order.userId,
        coupon_id: order.couponId,
        total_amount: order.totalAmount,
        discount_amount: order.discountAmount,
        final_amount: order.finalAmount,
        status: order.status.value, // OrderStatus VO에서 문자열 추출
        created_at: order.createdAt,
        paid_at: order.paidAt,
        expired_at: order.expiredAt,
        updated_at: order.updatedAt,
      },
    });
    return this.mapToDomain(created);
  }

  // ANCHOR update
  async update(order: Order): Promise<Order> {
    const updated = await this.prismaClient.orders.update({
      where: { id: BigInt(order.id) },
      data: {
        status: order.status.value, // OrderStatus VO에서 문자열 추출
        paid_at: order.paidAt,
        updated_at: order.updatedAt,
      },
    });
    return this.mapToDomain(updated);
  }

  /**
   * Helper 도메인 맵퍼
   */
  private mapToDomain(record: orders): Order {
    const toNumber = (value: any): number => {
      const maybeDecimal = value as { toNumber?: () => number };
      return typeof maybeDecimal?.toNumber === 'function'
        ? maybeDecimal.toNumber()
        : Number(value);
    };

    return new Order(
      Number(record.id),
      record.user_id,
      record.coupon_id,
      toNumber(record.total_amount),
      toNumber(record.discount_amount),
      toNumber(record.final_amount),
      OrderStatus.from(record.status), // OrderStatus VO로 변환
      record.created_at,
      record.paid_at,
      record.expired_at,
      record.updated_at,
    );
  }
}

/**
 * OrderItem Repository Implementation (Prisma)
 */
@Injectable()
export class OrderItemRepository implements IOrderItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get prismaClient(): Prisma.TransactionClient | PrismaService {
    return this.prisma.getClient();
  }

  // ANCHOR findManyByOrderId
  /**
   * TODO: [성능 개선 고려] 인덱스 활용
   * 현재 상태: WHERE order_id = ? 조건으로 조회
   * - 이미 idx_order_id 인덱스가 존재하여 기본 성능은 양호
   *
   * 추가 최적화 고려사항:
   * 1. 자주 함께 조회되는 컬럼이 있다면 Covering Index 고려
   *    예: SELECT id, product_option_id, quantity만 조회하는 경우
   *    CREATE INDEX idx_order_items_covering ON order_items(order_id, id, product_option_id, quantity);
   *
   * 현재는 큰 문제 없으나, 대용량 데이터 시 모니터링 필요
   */
  async findManyByOrderId(orderId: number): Promise<OrderItem[]> {
    const records = await this.prismaClient.order_items.findMany({
      where: { order_id: BigInt(orderId) },
    });
    return records.map((record) => this.mapToDomain(record));
  }

  // ANCHOR create
  async create(orderItem: OrderItem): Promise<OrderItem> {
    const created = await this.prismaClient.order_items.create({
      data: {
        order_id: BigInt(orderItem.orderId),
        product_option_id: orderItem.productOptionId,
        product_name: orderItem.productName,
        price: orderItem.price,
        quantity: orderItem.quantity,
        subtotal: orderItem.subtotal,
        created_at: orderItem.createdAt,
      },
    });
    return this.mapToDomain(created);
  }

  // ANCHOR createMany
  async createMany(orderItems: OrderItem[]): Promise<OrderItem[]> {
    return Promise.all(orderItems.map((item) => this.create(item)));
  }

  /**
   * Helper 도메인 맵퍼
   */
  private mapToDomain(record: order_items): OrderItem {
    const toNumber = (value: any): number => {
      const maybeDecimal = value as { toNumber?: () => number };
      return typeof maybeDecimal?.toNumber === 'function'
        ? maybeDecimal.toNumber()
        : Number(value);
    };

    return new OrderItem(
      Number(record.id),
      Number(record.order_id),
      record.product_option_id,
      record.product_name,
      toNumber(record.price),
      record.quantity,
      toNumber(record.subtotal),
      record.created_at,
    );
  }
}
