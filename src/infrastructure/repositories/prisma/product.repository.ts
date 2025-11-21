import { Injectable } from '@nestjs/common';
import {
  IProductRepository,
  IProductOptionRepository,
  IProductPopularitySnapshotRepository,
} from '@domain/interfaces/product.repository.interface';
import { Product } from '@domain/product/product.entity';
import { ProductOption } from '@domain/product/product-option.entity';
import { ProductPopularitySnapshot } from '@domain/product/product-popularity-snapshot.entity';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infrastructure/prisma/prisma.service';

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
  private mapToDomain(record: any): Product {
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
      const recordList: any[] =
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
  private mapToDomain(record: any): ProductOption {
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
 * ProductPopularitySnapshot Repository Implementation (Prisma)
 */
@Injectable()
export class ProductPopularitySnapshotRepository
  implements IProductPopularitySnapshotRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private get prismaClient(): Prisma.TransactionClient | PrismaService {
    return this.prisma.getClient();
  }

  // ANCHOR productPopularitySnapshot.findTop5
  /**
   * TODO: [성능 개선 필요] 비효율적인 ORDER BY 및 WHERE 절
   * 원인:
   * 1. 첫 번째 쿼리에서 created_at DESC 정렬로 최신 스냅샷 시간 조회
   * 2. 두 번째 쿼리에서 해당 시간의 데이터를 rank ASC로 정렬 조회
   * 3. WHERE created_at = ? 조건과 ORDER BY rank를 함께 사용하지만 복합 인덱스 부재
   *
   * 개선 방안:
   * 1. 복합 인덱스 추가: (created_at DESC, rank ASC)
   *    CREATE INDEX idx_snapshot_created_rank ON product_popularity_snapshot(created_at DESC, rank ASC);
   * 2. 또는 단일 쿼리로 최적화:
   *    SELECT * FROM (
   *      SELECT *, ROW_NUMBER() OVER (PARTITION BY created_at ORDER BY rank ASC) as rn
   *      FROM product_popularity_snapshot
   *      WHERE created_at = (SELECT MAX(created_at) FROM product_popularity_snapshot)
   *    ) WHERE rn <= count;
   *
   * 예상 효과: 인덱스 스캔으로 O(log n) 시간 복잡도 개선
   */
  async findTop(count: number): Promise<ProductPopularitySnapshot[]> {
    // 가장 최신 스냅샷의 생성 시간 찾기
    const latestSnapshot =
      await this.prismaClient.product_popularity_snapshot.findFirst({
        orderBy: { created_at: 'desc' },
        select: { created_at: true },
      });

    if (!latestSnapshot) {
      return [];
    }

    // 가장 최신 스냅샷만 추출하여 rank 순으로 정렬하여 Top N 반환
    const records =
      await this.prismaClient.product_popularity_snapshot.findMany({
        where: { created_at: latestSnapshot.created_at },
        orderBy: { rank: 'asc' },
        take: count,
      });

    return records.map((record) => this.mapToDomain(record));
  }

  // ANCHOR productPopularitySnapshot.create
  async create(
    snapshot: ProductPopularitySnapshot,
  ): Promise<ProductPopularitySnapshot> {
    const created = await this.prismaClient.product_popularity_snapshot.create({
      data: {
        product_id: snapshot.productId,
        product_name: snapshot.productName,
        price: snapshot.price,
        category: snapshot.category,
        rank: snapshot.rank,
        sales_count: snapshot.salesCount,
        last_sold_at: snapshot.lastSoldAt,
        created_at: snapshot.createdAt,
      },
    });
    return this.mapToDomain(created);
  }

  /**
   * Helper 도메인 맵퍼
   */
  private mapToDomain(record: any): ProductPopularitySnapshot {
    const maybeDecimal = record.price as { toNumber?: () => number };
    const price =
      typeof maybeDecimal?.toNumber === 'function'
        ? maybeDecimal.toNumber()
        : Number(record.price);

    return new ProductPopularitySnapshot(
      record.id,
      record.product_id,
      record.product_name,
      price,
      record.category,
      record.rank,
      record.sales_count,
      record.last_sold_at,
      record.created_at,
    );
  }
}
