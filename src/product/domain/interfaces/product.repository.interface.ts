import { Product } from '@/product/domain/entities/product.entity';
import { ProductOption } from '@/product/domain/entities/product-option.entity';
import { ProductPopularitySnapshot } from '@/product/domain/entities/product-popularity-snapshot.entity';

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

export abstract class IProductPopularitySnapshotRepository {
  abstract findTop(count: number): Promise<ProductPopularitySnapshot[]>;
  abstract create(
    snapshot: ProductPopularitySnapshot,
  ): Promise<ProductPopularitySnapshot>;
}
