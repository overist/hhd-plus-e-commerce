import { Injectable, Logger } from '@nestjs/common';
import { Prisma, product_options, products } from '@prisma/client';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import { RedisService } from '@common/redis/redis.service';
import {
  IProductRepository,
  IProductOptionRepository,
  IProductSalesRankingRepository,
} from '../domain/interfaces/product.repository.interface';
import { Product } from '@/product/domain/entities/product.entity';
import { ProductOption } from '@/product/domain/entities/product-option.entity';
import { ProductSalesRanking } from '@/product/domain/entities/product-sales.vo';
import { OrderItem } from '@/order/domain/entities/order-item.entity';

/**
 * Product Repository Implementation (Prisma)
 */
@Injectable()
export class ProductRepository implements IProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get prismaClient(): Prisma.TransactionClient | PrismaService {
    return this.prisma.getClient();
  }

  // ANCHOR product.findById
  async findById(id: number): Promise<Product | null> {
    const record = await this.prismaClient.products.findUnique({
      where: { id },
    });
    return record ? this.mapToDomain(record) : null;
  }

  // ANCHOR product.findManyByIds
  async findManyByIds(ids: number[]): Promise<Product[]> {
    if (ids.length === 0) {
      return [];
    }
    const records = await this.prismaClient.products.findMany({
      where: { id: { in: ids } },
    });
    return records.map((record) => this.mapToDomain(record));
  }

  // ANCHOR product.findAll
  async findAll(): Promise<Product[]> {
    const records = await this.prismaClient.products.findMany();
    return records.map((record) => this.mapToDomain(record));
  }

  // ANCHOR product.create
  async create(product: Product): Promise<Product> {
    const created = await this.prismaClient.products.create({
      data: {
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        is_available: product.isAvailable,
        created_at: product.createdAt,
        updated_at: product.updatedAt,
      },
    });
    return this.mapToDomain(created);
  }

  // ANCHOR product.update
  async update(product: Product): Promise<Product> {
    const updated = await this.prismaClient.products.update({
      where: { id: product.id },
      data: {
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        is_available: product.isAvailable,
        updated_at: product.updatedAt,
      },
    });
    return this.mapToDomain(updated);
  }

  /**
   * Helper 도메인 맵퍼
   */
  private mapToDomain(record: products): Product {
    const maybeDecimal = record.price as { toNumber?: () => number };
    const price =
      typeof maybeDecimal?.toNumber === 'function'
        ? maybeDecimal.toNumber()
        : Number(record.price);

    return new Product(
      record.id,
      record.name,
      record.description,
      price,
      record.category,
      record.is_available,
      record.created_at,
      record.updated_at,
    );
  }
}

/**
 * ProductOption Repository Implementation (Prisma)
 * 동시성 제어: 트랜잭션 컨텍스트에서 FOR UPDATE를 통한 비관적 잠금
 */
@Injectable()
export class ProductOptionRepository implements IProductOptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get prismaClient(): Prisma.TransactionClient | PrismaService {
    return this.prisma.getClient();
  }

  // ANCHOR productOption.findById
  async findById(id: number): Promise<ProductOption | null> {
    const tx = this.prisma.getTransactionClient();

    // 트랜잭션 컨텍스트가 있으면 FOR UPDATE 사용
    if (tx) {
      const recordList: product_options[] =
        await tx.$queryRaw`SELECT * FROM product_options WHERE id = ${id} FOR UPDATE`;
      const record = recordList.length > 0 ? recordList[0] : null;
      return record ? this.mapToDomain(record) : null;
    }

    // 트랜잭션 컨텍스트가 없으면 일반 조회
    const record = await this.prismaClient.product_options.findUnique({
      where: { id },
    });
    return record ? this.mapToDomain(record) : null;
  }

  // ANCHOR productOption.findManyByIds
  async findManyByIds(ids: number[]): Promise<ProductOption[]> {
    if (ids.length === 0) {
      return [];
    }
    const records = await this.prismaClient.product_options.findMany({
      where: { id: { in: ids } },
    });
    return records.map((record) => this.mapToDomain(record));
  }

  // ANCHOR productOption.findManyByProductId
  async findManyByProductId(productId: number): Promise<ProductOption[]> {
    const records = await this.prismaClient.product_options.findMany({
      where: { product_id: productId },
    });
    return records.map((record) => this.mapToDomain(record));
  }

  // ANCHOR productOption.create
  async create(productOption: ProductOption): Promise<ProductOption> {
    const created = await this.prismaClient.product_options.create({
      data: {
        product_id: productOption.productId,
        color: productOption.color,
        size: productOption.size,
        stock: productOption.stock,
        reserved_stock: productOption.reservedStock,
        created_at: productOption.createdAt,
        updated_at: productOption.updatedAt,
      },
    });
    return this.mapToDomain(created);
  }

  // ANCHOR productOption.update
  async update(productOption: ProductOption): Promise<ProductOption> {
    const updated = await this.prismaClient.product_options.update({
      where: { id: productOption.id },
      data: {
        color: productOption.color,
        size: productOption.size,
        stock: productOption.stock,
        reserved_stock: productOption.reservedStock,
        updated_at: productOption.updatedAt,
      },
    });
    return this.mapToDomain(updated);
  }

  /**
   * Helper 도메인 맵퍼
   */
  private mapToDomain(record: product_options): ProductOption {
    return new ProductOption(
      record.id,
      record.product_id,
      record.color,
      record.size,
      record.stock,
      record.reserved_stock,
      record.created_at,
      record.updated_at,
    );
  }
}

/**
 * ProductSalesRanking Repository Implementation (Redis)
 * 실시간 판매 랭킹 집계/조회
 */
@Injectable()
export class ProductSalesRankingRepository
  implements IProductSalesRankingRepository
{
  private static readonly SALES_RANKING_PREFIX = 'data:products:sales-rank';
  private readonly logger = new Logger(ProductSalesRankingRepository.name);

  constructor(private readonly redisService: RedisService) {}

  private get redisClient() {
    return this.redisService.getClient();
  }

  // ANCHOR recordSales (Redis)
  /**
   * 인기상품 랭킹 집계 - Redis Sorted Set 사용
   * @param orderItems 주문 아이템 엔티티 배열
   */
  recordSales(orderItems: OrderItem[]): void {
    const YYYYMMDD = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const key = `${ProductSalesRankingRepository.SALES_RANKING_PREFIX}:${YYYYMMDD}`;

    // Pipeline을 사용하여 순서 보장 및 일괄 처리
    const pipeline = this.redisClient.pipeline();

    for (const item of orderItems) {
      pipeline.zincrby(key, item.quantity, item.productOptionId.toString());
    }

    // 모든 zincrby 후 expire 설정 (31일)
    pipeline.expire(key, 60 * 60 * 24 * 31);

    // 비동기 실행 (fire-and-forget)
    pipeline.exec().catch((error) => {
      this.logger.error(
        `인기상품 랭킹 업데이트 실패 - key: ${key}`,
        error instanceof Error ? error.stack : error,
      );
    });
  }

  // ANCHOR findRankByDate (Redis)
  /**
   * 날짜별 인기상품 랭킹 조회 - Redis Sorted Set 사용
   */
  async findRankByDate(YYYYMMDD: string): Promise<ProductSalesRanking[]> {
    const key = `${ProductSalesRankingRepository.SALES_RANKING_PREFIX}:${YYYYMMDD}`;
    const results = await this.redisClient.zrevrange(key, 0, -1, 'WITHSCORES');

    const rankings: ProductSalesRanking[] = [];
    for (let i = 0; i < results.length; i += 2) {
      rankings.push(
        new ProductSalesRanking(Number(results[i]), Number(results[i + 1])),
      );
    }
    return rankings;
  }
}
