import { Module, forwardRef } from '@nestjs/common';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { ProductModule } from '../product/product.module';
import { UserModule } from '@/user/user.module';
import { CouponModule } from '../coupon/coupon.module';
import {
  IOrderRepository,
  IOrderItemRepository,
} from '@/order/domain/interfaces/order.repository.interface';
import {
  OrderRepository,
  OrderItemRepository,
} from '@/order/infrastructure/order.repository';
import { OrderController } from '@/order/presentation/order.controller';

// Use Cases
import { CreateOrderUseCase } from '@/order/application/create-order.use-case';
import { ProcessPaymentUseCase } from '@/order/application/process-payment.use-case';
import { GetOrdersUseCase } from '@/order/application/get-orders.use-case';
import { GetOrderDetailUseCase } from '@/order/application/get-order-detail.use-case';

// Infrastructure Services
import { OrderKafkaProducer } from '@/order/infrastructure/order.kafka.producer';
import { OrderProcessingStateStore } from '@/order/infrastructure/order-processing-state.store';

// Kafka Consumers
import { ExternalPlatformKafkaConsumer } from '@/order/presentation/consumers/external-platform.kafka.consumer';
import { OrderProcessingInitKafkaConsumer } from '@/order/presentation/consumers/order-processing-init.kafka.consumer';
import { OrderProcessingStockSuccessKafkaConsumer } from '@/order/presentation/consumers/order-processing-stock-success.kafka.consumer';
import { OrderProcessingCouponSuccessKafkaConsumer } from '@/order/presentation/consumers/order-processing-coupon-success.kafka.consumer';
import { OrderProcessingSuccessKafkaConsumer } from '@/order/presentation/consumers/order-processing-success.kafka.consumer';
import { OrderProcessingFailKafkaConsumer } from '@/order/presentation/consumers/order-processing-fail.kafka.consumer';
import { OrderPaymentSuccessKafkaConsumer } from '@/order/presentation/consumers/order-payment-success.kafka.consumer';
import { OrderPaymentFailKafkaConsumer } from '@/order/presentation/consumers/order-payment-fail.kafka.consumer';

/**
 * Order Module
 * 주문 및 결제 관리 모듈
 */
@Module({
  imports: [forwardRef(() => ProductModule), UserModule, CouponModule],
  controllers: [OrderController],
  providers: [
    // Order Repositories (자신의 도메인만)
    OrderRepository,
    {
      provide: IOrderRepository,
      useClass: OrderRepository,
    },
    OrderItemRepository,
    {
      provide: IOrderItemRepository,
      useClass: OrderItemRepository,
    },

    // Domain Service
    OrderDomainService,

    // Use Cases
    CreateOrderUseCase,
    ProcessPaymentUseCase,
    GetOrdersUseCase,
    GetOrderDetailUseCase,

    // Infrastructure Services
    OrderKafkaProducer,
    OrderProcessingStateStore,

    // Kafka Consumer
    OrderProcessingInitKafkaConsumer,
    OrderProcessingStockSuccessKafkaConsumer,
    OrderProcessingCouponSuccessKafkaConsumer,
    OrderProcessingSuccessKafkaConsumer,
    OrderProcessingFailKafkaConsumer,
    OrderPaymentSuccessKafkaConsumer,
    OrderPaymentFailKafkaConsumer,
    ExternalPlatformKafkaConsumer,
  ],
  exports: [OrderDomainService, IOrderRepository, IOrderItemRepository],
})
export class OrderModule {}
