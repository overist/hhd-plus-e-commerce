import { Injectable } from '@nestjs/common';
import {
  IProductOptionRepository,
  IProductSalesRankingRepository,
  IProductRepository,
} from '@/product/domain/interfaces/product.repository.interface';
import { Product } from '../entities/product.entity';
import { ProductOption } from '../entities/product-option.entity';
import { ProductSalesRanking } from '../entities/product-sales.vo';
import { ErrorCode, DomainException } from '@common/exception';
import { OrderItemData } from '@/order/domain/entities/order.types';
import { OrderItem } from '@/order/domain/entities/order-item.entity';

/**
 * ProductDomainService
 * 상품 관련 영속성 계층과 상호작용하며 핵심 비즈니스 로직을 담당한다.
 */
@Injectable()
export class ProductDomainService {
  constructor(
    private readonly productRepository: IProductRepository,
    private readonly productOptionRepository: IProductOptionRepository,
    private readonly productSalesRankingRepository: IProductSalesRankingRepository,
  ) {}

  /**
   * ANCHOR 판매 가능 상품 목록 조회
   */
  async getProductsOnSale(): Promise<Product[]> {
    const products = await this.productRepository.findAll();
    return products.filter((product) => product.isAvailable);
  }

  /**
   * ANCHOR 상품 단건 조회
   */
  async getProduct(productId: number): Promise<Product> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new DomainException(ErrorCode.PRODUCT_NOT_FOUND);
    }
    return product;
  }

  /**
   * ANCHOR 상품 일괄 조회
   */
  async getProductsByIds(productIds: number[]): Promise<Product[]> {
    if (productIds.length === 0) {
      return [];
    }
    const products = await this.productRepository.findManyByIds(productIds);
    return products;
  }

  /**
   * ANCHOR 상품 상세 및 옵션 조회 (재고 포함)
   */
  async getProductOptions(productId: number): Promise<ProductOption[]> {
    const options =
      await this.productOptionRepository.findManyByProductId(productId);

    return options;
  }

  /**
   * ANCHOR 상품 옵션 단건 조회
   */
  async getProductOption(productOptionId: number): Promise<ProductOption> {
    const option = await this.productOptionRepository.findById(productOptionId);
    if (!option) {
      throw new DomainException(ErrorCode.PRODUCT_OPTION_NOT_FOUND);
    }
    return option;
  }

  /**
   * ANCHOR 상품 옵션 일괄 조회
   */
  async getProductOptionsByIds(
    productOptionIds: number[],
  ): Promise<ProductOption[]> {
    if (productOptionIds.length === 0) {
      return [];
    }
    const options =
      await this.productOptionRepository.findManyByIds(productOptionIds);
    return options;
  }

  /**
   * ANCHOR 인기 상품 조회 (Redis 기반)
   * N일간 판매 랭킹을 조회하여 반환
   */
  async getTopProducts(
    count: number,
    days: number = 3,
  ): Promise<ProductSalesRanking[]> {
    if (count <= 0) {
      throw new DomainException(ErrorCode.INVALID_ARGUMENT);
    }

    return this.getSalesRankingDays(count, days);
  }

  /**
   * ANCHOR 상품 재고 관리자 업데이트
   * 상품 재고 수량을 증가시키거나 선점중인 재고수량 까지 차감시킬 수 있다.
   */
  async updateProductOptionStock(
    productOptionId: number,
    operation: 'increase' | 'decrease',
    quantity: number,
  ): Promise<void> {
    const option = await this.productOptionRepository.findById(productOptionId);
    if (!option) {
      throw new DomainException(ErrorCode.PRODUCT_OPTION_NOT_FOUND);
    }

    if (operation === 'decrease') {
      if (option.stock < quantity) {
        throw new DomainException(ErrorCode.INSUFFICIENT_STOCK);
      }
      option.adjustStock(option.stock - quantity);
    } else if (operation === 'increase') {
      option.adjustStock(option.stock + quantity);
    } else {
      throw new DomainException(ErrorCode.INVALID_ARGUMENT);
    }

    await this.productOptionRepository.update(option); // save
  }

  /**
   * ANCHOR 주문용 상품 정보 조회 및 재고 선점
   */
  async reserveProductsForOrder(
    items: Array<{ productOptionId: number; quantity: number }>,
  ): Promise<OrderItemData[]> {
    const orderItemsData: OrderItemData[] = [];

    for (const item of items) {
      const productOption = await this.getProductOption(item.productOptionId);
      const product = await this.getProduct(productOption.productId);

      productOption.reserveStock(item.quantity);
      await this.productOptionRepository.update(productOption);

      orderItemsData.push({
        productName: product.name,
        price: product.price,
        productOptionId: productOption.id,
        quantity: item.quantity,
      });
    }

    return orderItemsData;
  }

  /**
   * ANCHOR 결제 완료 시 재고 확정 차감
   */
  async confirmPaymentStock(
    productOptionId: number,
    quantity: number,
  ): Promise<void> {
    const option = await this.productOptionRepository.findById(productOptionId);
    if (!option) {
      throw new DomainException(ErrorCode.PRODUCT_OPTION_NOT_FOUND);
    }

    option.decreaseStock(quantity);
    await this.productOptionRepository.update(option);
  }

  /**
   * ANCHOR 결제 실패 시 재고 복원 (보상 트랜잭션)
   * 확정 차감된 재고를 다시 선점 상태로 되돌림
   */
  async restoreStockAfterPaymentFailure(
    productOptionId: number,
    quantity: number,
  ): Promise<void> {
    const option = await this.productOptionRepository.findById(productOptionId);
    if (!option) {
      throw new DomainException(ErrorCode.PRODUCT_OPTION_NOT_FOUND);
    }

    option.restoreStock(quantity);
    await this.productOptionRepository.update(option);
  }

  /**
   * ANCHOR 인기상품 랭킹 집계
   * @param orderItems 주문 아이템 엔티티 배열
   */
  recordSales(orderItems: OrderItem[]): void {
    this.productSalesRankingRepository.recordSales(orderItems);
  }

  /**
   * ANCHOR N일간 인기상품 랭킹 조회
   */
  async getSalesRankingDays(
    count: number,
    days: number = 3,
  ): Promise<ProductSalesRanking[]> {
    const MAX_DATE_RANGE_DAYS = 30;
    if (days <= 0 || days > MAX_DATE_RANGE_DAYS) {
      throw new DomainException(ErrorCode.INVALID_ARGUMENT);
    }

    const aggregateMap: Map<number, number> = new Map();

    // dateRangeDays 일 수만큼 반복하여 각 날짜의 랭킹 조회
    const rankPromises: Promise<ProductSalesRanking[]>[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const YYYYMMDD = date.toISOString().split('T')[0].replace(/-/g, '');
      rankPromises.push(
        this.productSalesRankingRepository.findRankByDate(YYYYMMDD),
      );
    }

    const ranks = await Promise.all(rankPromises);

    // 모든 랭킹 데이터 집계
    for (const rank of ranks) {
      for (const ranking of rank) {
        const currentCount = aggregateMap.get(ranking.productOptionId) || 0;
        aggregateMap.set(
          ranking.productOptionId,
          currentCount + ranking.salesCount,
        );
      }
    }

    const aggregatedRanks = Array.from(aggregateMap.entries()).map(
      ([productOptionId, salesCount]) =>
        new ProductSalesRanking(productOptionId, salesCount),
    );

    aggregatedRanks.sort((a, b) => b.salesCount - a.salesCount);

    return aggregatedRanks.slice(0, count);
  }
}
