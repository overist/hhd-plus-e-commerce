import { Module } from '@nestjs/common';
import { OrderFacade } from '@application/facades/order.facade';
import { OrderDomainService } from '@domain/order/order.service';
import { ProductDomainService } from '@domain/product/product.service';
import { UserDomainService } from '@domain/user/user.service';
import { CouponDomainService } from '@domain/coupon/coupon.service';
import { ProductModule } from './product.module';
import { UserModule } from './user.module';
import { CouponModule } from './coupon.module';
import {
  IOrderRepository,
  IOrderItemRepository,
} from '@domain/interfaces/order.repository.interface';
import {
  OrderRepository,
  OrderItemRepository,
} from '@infrastructure/repositories/prisma/order.repository';
import { OrderController } from '@presentation/order/order.controller';

/**
 * Order Module
 * 주문 및 결제 관리 모듈
 */
@Module({
  imports: [ProductModule, UserModule, CouponModule],
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

    // Facade
    OrderFacade,
  ],
  exports: [OrderDomainService, IOrderRepository, IOrderItemRepository],
})
export class OrderModule {}
