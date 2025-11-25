import { Module } from '@nestjs/common';
import { ProductDomainService } from '@/product/domain/services/product.service';
import {
  IProductRepository,
  IProductOptionRepository,
  IProductPopularitySnapshotRepository,
} from '@/product/domain/interfaces/product.repository.interface';
import {
  ProductPrismaRepository,
  ProductOptionRepository,
  ProductPopularitySnapshotRepository,
} from '@/product/infrastructure/product.prisma.repository';
import { ProductController } from '@/product/presentation/product.controller';

// Use Cases
import { GetProductsUseCase } from '@/product/application/get-products.use-case';
import { GetProductDetailUseCase } from '@/product/application/get-product-detail.use-case';
import { GetTopProductsUseCase } from '@/product/application/get-top-products.use-case';
import { UpdateStockUseCase } from '@/product/application/update-stock.use-case';

/**
 * Product Module
 * 상품 관련 기능 모듈
 */
@Module({
  controllers: [ProductController],
  providers: [
    // Product Repositories
    ProductPrismaRepository,
    {
      provide: IProductRepository,
      useClass: ProductPrismaRepository,
    },
    ProductOptionRepository,
    {
      provide: IProductOptionRepository,
      useClass: ProductOptionRepository,
    },
    ProductPopularitySnapshotRepository,
    {
      provide: IProductPopularitySnapshotRepository,
      useClass: ProductPopularitySnapshotRepository,
    },

    // Domain Service
    ProductDomainService,

    // Use Cases
    GetProductsUseCase,
    GetProductDetailUseCase,
    GetTopProductsUseCase,
    UpdateStockUseCase,
  ],
  exports: [
    ProductDomainService,
    IProductRepository,
    IProductOptionRepository,
    IProductPopularitySnapshotRepository,
  ],
})
export class ProductModule {}
