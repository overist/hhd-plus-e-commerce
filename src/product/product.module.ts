import { Module, forwardRef } from '@nestjs/common';
import { ProductDomainService } from '@/product/domain/services/product.service';
import {
  IProductRepository,
  IProductOptionRepository,
  IProductPopularitySnapshotRepository,
} from '@/product/domain/interfaces/product.repository.interface';
import {
  ProductRepository,
  ProductOptionRepository,
  ProductPopularitySnapshotRepository,
} from '@/product/infrastructure/product.repository';
import { ProductController } from '@/product/presentation/product.controller';
import { OrderModule } from '@/order/order.module';

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
  imports: [forwardRef(() => OrderModule)],
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
