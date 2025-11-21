import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  IProductRepository,
  IProductOptionRepository,
  IProductPopularitySnapshotRepository,
} from '@domain/interfaces/product.repository.interface';
import {
  IOrderItemRepository,
  IOrderRepository,
} from '@domain/interfaces/order.repository.interface';
import { ProductPopularitySnapshot } from '@domain/product/product-popularity-snapshot.entity';

/**
 * Product Popularity Scheduler
 * 인기 상품 스냅샷 생성 스케줄러
 * 1일마다 최근 3일간 판매량 기준 상위 5개 상품을 집계하여 저장
 */
@Injectable()
export class ProductPopularityScheduler {
  private readonly logger = new Logger(ProductPopularityScheduler.name);
  private snapshotId = 1;

  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly orderItemRepository: IOrderItemRepository,
    private readonly productRepository: IProductRepository,
    private readonly productOptionRepository: IProductOptionRepository,
    private readonly productPopularitySnapshotRepository: IProductPopularitySnapshotRepository,
  ) {}

  /**
   * 인기 상품 스냅샷 업데이트
   * 1일 마다 실행
   * US-003: 최근 3일간 결제 완료된 주문만 집계
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateTopProducts() {
    try {
      this.logger.log('인기 상품 스냅샷 업데이트 시작');

      // 최근 3일 기준 날짜 계산
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      // 모든 주문 조회 (실제로는 전체 주문을 메모리로 가져와야 함)
      // 임시: userId=0으로 조회 (실제로는 findAll 같은 메서드 필요)
      const allOrders = await this.orderRepository.findManyByUserId(0);

      // 최근 3일간 결제 완료된 주문만 필터링
      const recentPaidOrders = allOrders.filter(
        (order) =>
          order.status.isPaid() && order.paidAt && order.paidAt >= threeDaysAgo,
      );

      if (recentPaidOrders.length === 0) {
        this.logger.log('최근 3일간 결제 완료된 주문이 없습니다');
        return;
      }

      // 주문 ID 목록 추출
      const orderIds = recentPaidOrders.map((order) => order.id);

      // 모든 주문 아이템 조회 후 필터링
      const allOrderItems = await Promise.all(
        orderIds.map((orderId) =>
          this.orderItemRepository.findManyByOrderId(orderId),
        ),
      );
      const recentOrderItems = allOrderItems.flat();

      if (recentOrderItems.length === 0) {
        this.logger.log('최근 3일간 결제 완료된 주문 상품이 없습니다');
        return;
      }

      // 상품 옵션별 판매량 집계
      const optionSalesMap = new Map<
        number,
        {
          productOptionId: number;
          productName: string;
          price: number;
          quantity: number;
          lastSoldAt: Date;
        }
      >();

      for (const item of recentOrderItems) {
        const existing = optionSalesMap.get(item.productOptionId);
        if (existing) {
          existing.quantity += item.quantity;
          if (item.createdAt > existing.lastSoldAt) {
            existing.lastSoldAt = item.createdAt;
          }
        } else {
          optionSalesMap.set(item.productOptionId, {
            productOptionId: item.productOptionId,
            productName: item.productName,
            price: item.price,
            quantity: item.quantity,
            lastSoldAt: item.createdAt,
          });
        }
      }

      // 상품별로 판매량 집계 (productId 기준)
      const productSalesMap = new Map<
        number,
        {
          productId: number;
          productName: string;
          price: number;
          category: string;
          quantity: number;
          lastSoldAt: Date;
        }
      >();

      // productOptionId로 productId 조회
      const optionIds = Array.from(optionSalesMap.keys());

      // 각 옵션을 개별적으로 조회
      const options = await Promise.all(
        optionIds.map((id) => this.productOptionRepository.findById(id)),
      );
      const validOptions = options.filter((opt) => opt !== null);

      for (const option of validOptions) {
        if (!option) continue;
        const optionSales = optionSalesMap.get(option.id);
        if (!optionSales) continue;

        const product = await this.productRepository.findById(option.productId);
        if (!product) continue;

        const existing = productSalesMap.get(product.id);
        if (existing) {
          existing.quantity += optionSales.quantity;
          if (optionSales.lastSoldAt > existing.lastSoldAt) {
            existing.lastSoldAt = optionSales.lastSoldAt;
          }
        } else {
          productSalesMap.set(product.id, {
            productId: product.id,
            productName: product.name,
            price: product.price,
            category: product.category,
            quantity: optionSales.quantity,
            lastSoldAt: optionSales.lastSoldAt,
          });
        }
      }

      // 판매량 기준 내림차순 정렬 후 상위 5개 추출
      // US-003: 판매 수가 동일한 경우 더 최근에 결제된 상품이 우선순위
      const topProducts = Array.from(productSalesMap.values())
        .sort((a, b) => {
          // 1차 정렬: 판매량 내림차순
          if (b.quantity !== a.quantity) {
            return b.quantity - a.quantity;
          }
          // 2차 정렬: 최근 결제 시각 내림차순
          return b.lastSoldAt.getTime() - a.lastSoldAt.getTime();
        })
        .slice(0, 5);

      // 현재 시간의 스냅샷만 저장 (이전 스냅샷은 유지)
      const now = new Date();
      for (let index = 0; index < topProducts.length; index++) {
        const product = topProducts[index];
        const snapshot = new ProductPopularitySnapshot(
          this.snapshotId++,
          product.productId,
          product.productName,
          product.price,
          product.category,
          index + 1, // rank
          product.quantity,
          product.lastSoldAt,
          now,
        );
        await this.productPopularitySnapshotRepository.create(snapshot);
      }

      this.logger.log(
        `인기 상품 스냅샷 업데이트 완료: ${topProducts.length}개`,
      );
    } catch (error) {
      this.logger.error('인기 상품 스냅샷 업데이트 실패', error);
    }
  }
}
