import { Product } from '@/product/domain/entities/product.entity';
import { ProductOption } from '@/product/domain/entities/product-option.entity';
import { ProductSalesRanking } from '@/product/domain/entities/product-sales.vo';
import { OrderItem } from '@/order/domain/entities/order-item.entity';

/**
 * Product Repository Port
 * 상품 데이터 접근 계약
 */
export abstract class IProductRepository {
  abstract findById(id: number): Promise<Product | null>;
  abstract findManyByIds(ids: number[]): Promise<Product[]>;
  abstract findAll(): Promise<Product[]>; // TODO 페이징, 필터
  abstract create(product: Product): Promise<Product>;
  abstract update(product: Product): Promise<Product>;
}

/**
 * ProductOption Repository Port
 * 상품 옵션 데이터 접근 계약
 */
export abstract class IProductOptionRepository {
  abstract findById(id: number): Promise<ProductOption | null>;
  abstract findManyByIds(ids: number[]): Promise<ProductOption[]>;
  abstract findManyByProductId(productId: number): Promise<ProductOption[]>;
  abstract create(productOption: ProductOption): Promise<ProductOption>;
  abstract update(productOption: ProductOption): Promise<ProductOption>;
}

/**
 * ProductSalesRanking Repository Port
 * 상품 판매 랭킹 데이터 접근 계약 (Redis)
 */
export abstract class IProductSalesRankingRepository {
  /**
   * 인기상품 랭킹 집계 (Redis Sorted Set)
   */
  abstract recordSales(orderItems: OrderItem[]): void;

  /**
   * 날짜별 인기상품 랭킹 조회 (Redis Sorted Set)
   */
  abstract findRankByDate(date: string): Promise<ProductSalesRanking[]>;
}
