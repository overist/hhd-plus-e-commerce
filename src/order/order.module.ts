import { Module } from '@nestjs/common';
import { OrderFacade } from '@/order/application/order.facade';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { UserDomainService } from '@/user/domain/services/user.service';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import { ProductModule } from '../product/product.module';
import { UserModule } from '@/user/user.module';
import { CouponModule } from '../coupon/coupon.module';
import {
  IOrderRepository,
  IOrderItemRepository,
} from '@/order/domain/interfaces/order.repository.interface';
import {
  OrderPrismaRepository,
  OrderItemRepository,
} from '@/order/infrastructure/order.prisma.repository';
import { OrderController } from '@/order/presentation/order.controller';

/**
 * Order Module
 * 주문 및 결제 관리 모듈
 */
@Module({
  imports: [ProductModule, UserModule, CouponModule],
  controllers: [OrderController],
  providers: [
    // Order Repositories (자신의 도메인만)
    OrderPrismaRepository,
    {
      provide: IOrderRepository,
      useClass: OrderPrismaRepository,
    },
    OrderItemRepository,
    {
      provide: IOrderItemRepository,
      useClass: OrderItemRepository,
    },

    // Domain Service
    OrderDomainService,

    // Facade
    OrderFacade,
  ],
  exports: [OrderDomainService, IOrderRepository, IOrderItemRepository],
})
export class OrderModule {}
