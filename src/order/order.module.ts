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

// Event Listeners
import { OnOrderProcessingListener } from '@/order/application/listeners/on-order-processing.listener';
import { OnOrderProcessingSuccessListener } from '@/order/application/listeners/on-order-processing-success.listener';
import { OnOrderPaymentSuccessListener } from '@/order/application/listeners/on-order-payment-success.listener';
import { OnOrderProcessedListener } from '@/order/application/listeners/on-order-processed.listener';
import { OnOrderFailListener } from '@/order/application/listeners/on-order-fail.listener';

// Infrastructure Services
import { OrderKafkaProducer } from '@/order/infrastructure/order.kafka.producer';

// Kafka Consumers
import { ExternalPlatformKafkaConsumer } from '@/order/presentation/consumers/external-platform.kafka.consumer';

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

    // Event Listeners
    OnOrderProcessingListener,
    OnOrderProcessingSuccessListener,
    OnOrderPaymentSuccessListener,
    OnOrderProcessedListener,
    OnOrderFailListener,

    // Infrastructure Services
    OrderKafkaProducer,

    // Kafka Consumer
    // TODO API 서버는 애플리케이션 계층만, 컨슈머 서버는 컨슈머 계층만 써야함
    ExternalPlatformKafkaConsumer,
  ],
  exports: [OrderDomainService, IOrderRepository, IOrderItemRepository],
})
export class OrderModule {}
