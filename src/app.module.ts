import { Module } from '@nestjs/common';

// GLOBAL MODULES
import { GlobalPrismaModule } from './@common/prisma-manager/prisma.module';
import { GlobalRedisModule } from './@common/redis/redis.module';
import { GlobalRedisLockModule } from './@common/redis-lock-manager/redis.lock.module';
import { GlobalCacheModule } from './@common/cache-manager/cache.module';
import { HealthModule } from './@common/health/health.module';

// AUTH MODULE
import { AuthModule } from './@auth/auth.module';

// APP MODULES
import { ProductModule } from './product/product.module';
import { UserModule } from './user/user.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';
import { CouponModule } from './coupon/coupon.module';
import { SchedulerModule } from './@schedulers/scheduler.module';

@Module({
  imports: [
    // GLOBAL
    GlobalPrismaModule,
    GlobalRedisModule,
    GlobalRedisLockModule,
    GlobalCacheModule,
    HealthModule,

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
