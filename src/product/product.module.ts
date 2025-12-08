import { Module } from '@nestjs/common';
import { ProductDomainService } from '@/product/domain/services/product.service';
import {
  IProductRepository,
  IProductOptionRepository,
  IProductSalesRankingRepository,
} from '@/product/domain/interfaces/product.repository.interface';
import {
  ProductRepository,
  ProductOptionRepository,
  ProductSalesRankingRepository,
} from '@/product/infrastructure/product.repository';
import { ProductController } from '@/product/presentation/product.controller';

// Use Cases
import { GetProductsUseCase } from '@/product/application/get-products.use-case';
import { GetProductDetailUseCase } from '@/product/application/get-product-detail.use-case';
import { GetTopProductsUseCase } from '@/product/application/get-top-products.use-case';
import { UpdateStockUseCase } from '@/product/application/update-stock.use-case';

// Event Listeners

import { OnOrderProcessingListener } from './application/listeners/on-order-processing.listener';
import { OnOrderProcessedListener } from './application/listeners/on-order-processed.listener';

/**
 * Product Module
 * 상품 관련 기능 모듈
 */
@Module({
  imports: [],
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
    ProductSalesRankingRepository,
    {
      provide: IProductSalesRankingRepository,
      useClass: ProductSalesRankingRepository,
    },

    // Domain Service
    ProductDomainService,

    // Use Cases
    GetProductsUseCase,
    GetProductDetailUseCase,
    GetTopProductsUseCase,
    UpdateStockUseCase,

    // Event Listeners
    OnOrderProcessingListener,
    OnOrderProcessedListener,
  ],
  exports: [
    ProductDomainService,
    IProductRepository,
    IProductOptionRepository,
    IProductSalesRankingRepository,
  ],
})
export class ProductModule {}
