import { Module } from '@nestjs/common';
import {
  AuthModule,
  ProductModule,
  UserModule,
  CartModule,
  OrderModule,
  CouponModule,
  SchedulerModule,
} from '@infrastructure/modules';
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
