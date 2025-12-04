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
  ],
  exports: [OrderDomainService, IOrderRepository, IOrderItemRepository],
})
export class OrderModule {}
