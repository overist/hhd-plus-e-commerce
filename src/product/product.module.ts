import { Module } from '@nestjs/common';
import { ProductFacade } from '@/product/application/product.facade';
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

    // Facade
    ProductFacade,
  ],
  exports: [
    ProductDomainService,
    IProductRepository,
    IProductOptionRepository,
    IProductPopularitySnapshotRepository,
  ],
})
export class ProductModule {}
