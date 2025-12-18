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
import { ProductKafkaProducer } from '@/product/infrastructure/product.kafka.producer';
import { ProductOrderProcessingKafkaConsumer } from '@/product/presentation/consumers/order-processing.kafka.consumer';
import { ProductOrderProcessedKafkaConsumer } from '@/product/presentation/consumers/order-processed.kafka.consumer';
import { ProductOrderProcessingFailKafkaConsumer } from '@/product/presentation/consumers/order-processing-fail.kafka.consumer';
import { ProductOrderPaymentFailKafkaConsumer } from '@/product/presentation/consumers/order-payment-fail.kafka.consumer';

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

    // Kafka Producer/Consumers
    ProductKafkaProducer,
    ProductOrderProcessingKafkaConsumer,
    ProductOrderProcessedKafkaConsumer,
    ProductOrderProcessingFailKafkaConsumer,
    ProductOrderPaymentFailKafkaConsumer,
  ],
  exports: [
    ProductDomainService,
    IProductRepository,
    IProductOptionRepository,
    IProductSalesRankingRepository,
  ],
})
export class ProductModule {}
