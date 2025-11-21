import { Module } from '@nestjs/common';
import { AuthModule } from './infrastructure/modules/auth.module';
import { ProductModule } from './infrastructure/modules/product.module';
import { UserModule } from './infrastructure/modules/user.module';
import { CartModule } from './infrastructure/modules/cart.module';
import { OrderModule } from './infrastructure/modules/order.module';
import { CouponModule } from './infrastructure/modules/coupon.module';
import { SchedulerModule } from './infrastructure/modules/scheduler.module';
import { GlobalPrismaModule } from '@infrastructure/prisma/prisma.module';

@Module({
  imports: [
    // GLOBAL
    GlobalPrismaModule,

    // AUTH MODULE
    AuthModule,

    // APP MODULES
    ProductModule,
    UserModule,
    CartModule,
    OrderModule,
    CouponModule,
    SchedulerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
