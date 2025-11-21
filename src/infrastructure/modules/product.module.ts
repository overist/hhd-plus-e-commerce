import { Module } from '@nestjs/common';
import { ProductFacade } from '@application/facades/product.facade';
import { ProductDomainService } from '@domain/product/product.service';
import {
  IProductRepository,
  IProductOptionRepository,
  IProductPopularitySnapshotRepository,
} from '@domain/interfaces/product.repository.interface';
import {
  ProductRepository,
  ProductOptionRepository,
  ProductPopularitySnapshotRepository,
} from '@infrastructure/repositories/prisma/product.repository';
import { ProductController } from '@presentation/product/product.controller';

/**
 * Product Module
 * 상품 관련 기능 모듈
 */
@Module({
  controllers: [ProductController],
  providers: [
    // Product Repositories
    ProductRepository,
    {
      provide: IProductRepository,
      useClass: ProductRepository,
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
