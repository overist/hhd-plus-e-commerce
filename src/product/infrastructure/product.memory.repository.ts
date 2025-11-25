import { Injectable } from '@nestjs/common';
import { MutexManager } from '@common/mutex-manager/mutex-manager';
import { Product } from '../domain/entities/product.entity';
import {
  IProductOptionRepository,
  IProductPopularitySnapshotRepository,
  IProductRepository,
} from '../domain/interfaces/product.repository.interface';
import { ProductOption } from '../domain/entities/product-option.entity';
import { ProductPopularitySnapshot } from '../domain/entities/product-popularity-snapshot.entity';

/**
 * Product Repository Implementation (In-Memory)
 */
@Injectable()
export class ProductMemoryRepository implements IProductRepository {
  private products: Map<number, Product> = new Map();
  private currentId = 1;

  // ANCHOR product.findById
  async findById(id: number): Promise<Product | null> {
    return this.products.get(id) || null;
  }

  // ANCHOR product.findManyByIds
  async findManyByIds(ids: number[]): Promise<Product[]> {
    return ids
      .map((id) => this.products.get(id))
      .filter((product): product is Product => product !== undefined);
  }

  // ANCHOR product.findAll
  async findAll(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  // ANCHOR product.create
  async create(product: Product): Promise<Product> {
    const newProduct = new Product(
      this.currentId++,
      product.name,
      product.description,
      product.price,
      product.category,
      product.isAvailable,
      product.createdAt,
      product.updatedAt,
    );
    this.products.set(newProduct.id, newProduct);
    return newProduct;
  }

  // ANCHOR product.update
  async update(product: Product): Promise<Product> {
    this.products.set(product.id, product);
    return product;
  }
}

/**
 * ProductOption Repository Implementation (In-Memory)
 * 동시성 제어: 상품 옵션별 재고 변경 시 Mutex를 통한 직렬화 보장
 */
@Injectable()
export class ProductOptionRepository implements IProductOptionRepository {
  private productOptions: Map<number, ProductOption> = new Map();
  private currentId = 1;
  private readonly mutexManager = new MutexManager();

  // ANCHOR productOption.findById
  async findById(id: number): Promise<ProductOption | null> {
    return this.productOptions.get(id) || null;
  }

  // ANCHOR productOption.findManyByIds
  async findManyByIds(ids: number[]): Promise<ProductOption[]> {
    return ids
      .map((id) => this.productOptions.get(id))
      .filter((option): option is ProductOption => option !== undefined);
  }

  // ANCHOR productOption.findManyByProductId
  async findManyByProductId(productId: number): Promise<ProductOption[]> {
    return Array.from(this.productOptions.values()).filter(
      (option) => option.productId === productId,
    );
  }

  // ANCHOR productOption.create
  async create(productOption: ProductOption): Promise<ProductOption> {
    const unlock = await this.mutexManager.acquire(0);

    try {
      const newOption = new ProductOption(
        this.currentId++,
        productOption.productId,
        productOption.color,
        productOption.size,
        productOption.stock,
        productOption.reservedStock,
        productOption.createdAt,
        productOption.updatedAt,
      );
      this.productOptions.set(newOption.id, newOption);
      return newOption;
    } finally {
      unlock();
    }
  }

  // ANCHOR productOption.update
  async update(productOption: ProductOption): Promise<ProductOption> {
    const unlock = await this.mutexManager.acquire(productOption.id);
    try {
      this.productOptions.set(productOption.id, productOption);
      return productOption;
    } finally {
      unlock();
    }
  }
}

/**
 * ProductPopularitySnapshot Repository Implementation (In-Memory)
 */
@Injectable()
export class ProductPopularitySnapshotRepository
  implements IProductPopularitySnapshotRepository
{
  private snapshots: Map<number, ProductPopularitySnapshot> = new Map();
  private currentId = 1;

  // ANCHOR productPopularitySnapshot.findTop5
  async findTop(count: number): Promise<ProductPopularitySnapshot[]> {
    // 스냅샷이 없으면 빈 배열 반환
    if (this.snapshots.size === 0) {
      return [];
    }

    // 가장 최신 스냅샷의 생성 시간 찾기
    const allSnapshots = Array.from(this.snapshots.values());
    const latestCreatedAt = allSnapshots.reduce(
      (max, s) => (s.createdAt > max ? s.createdAt : max),
      allSnapshots[0].createdAt,
    );

    // 가장 최신 스냅샷만 추출하여 rank 순으로 정렬하여 Top 5 반환
    return allSnapshots
      .filter((s) => s.createdAt.getTime() === latestCreatedAt.getTime())
      .sort((a, b) => a.rank - b.rank)
      .slice(0, count);
  }

  // ANCHOR productPopularitySnapshot.create
  async create(
    snapshot: ProductPopularitySnapshot,
  ): Promise<ProductPopularitySnapshot> {
    const newSnapshot = new ProductPopularitySnapshot(
      this.currentId++,
      snapshot.productId,
      snapshot.productName,
      snapshot.price,
      snapshot.category,
      snapshot.rank,
      snapshot.salesCount,
      snapshot.lastSoldAt,
      snapshot.createdAt,
    );
    this.snapshots.set(newSnapshot.id, newSnapshot);
    return newSnapshot;
  }
}
