import { Injectable } from '@nestjs/common';
import { MutexManager } from '@common/mutex-manager/mutex-manager';
import { Product } from '../domain/entities/product.entity';
import {
  IProductOptionRepository,
  IProductSalesRankingRepository,
  IProductRepository,
} from '../domain/interfaces/product.repository.interface';
import { ProductOption } from '../domain/entities/product-option.entity';
import { ProductSalesRanking } from '../domain/entities/product-sales.vo';
import { OrderItem } from '@/order/domain/entities/order-item.entity';

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
 * ProductSalesRanking Repository Implementation (In-Memory)
 * 판매 랭킹 집계/조회
 */
@Injectable()
export class ProductSalesRankingRepository
  implements IProductSalesRankingRepository
{
  private salesRankings: Map<string, Map<number, number>> = new Map(); // date -> productOptionId -> salesCount

  // ANCHOR recordSales (In-Memory)
  /**
   * 인기상품 랭킹 집계
   * @param orderItems 주문 아이템 엔티티 배열
   */
  recordSales(orderItems: OrderItem[]): void {
    const YYYYMMDD = new Date().toISOString().split('T')[0].replace(/-/g, '');

    if (!this.salesRankings.has(YYYYMMDD)) {
      this.salesRankings.set(YYYYMMDD, new Map());
    }

    const dailyRanking = this.salesRankings.get(YYYYMMDD)!;
    for (const item of orderItems) {
      const currentCount = dailyRanking.get(item.productOptionId) || 0;
      dailyRanking.set(item.productOptionId, currentCount + item.quantity);
    }
  }

  // ANCHOR findRankByDate (In-Memory)
  async findRankByDate(YYYYMMDD: string): Promise<ProductSalesRanking[]> {
    const dailyRanking = this.salesRankings.get(YYYYMMDD);
    if (!dailyRanking) {
      return [];
    }

    return Array.from(dailyRanking.entries())
      .map(
        ([productOptionId, salesCount]) =>
          new ProductSalesRanking(productOptionId, salesCount),
      )
      .sort((a, b) => b.salesCount - a.salesCount);
  }
}
