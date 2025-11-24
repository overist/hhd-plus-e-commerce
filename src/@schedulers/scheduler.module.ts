import { OrderModule } from '@/order/order.module';
import { ProductModule } from '@/product/product.module';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { OrderExpirationScheduler } from './order-expiration.scheduler';
import { ProductPopularityScheduler } from './product-popularity.scheduler';

/**
 * Scheduler Module
 * 스케줄링 작업 관리 모듈
 */
@Module({
  imports: [ScheduleModule.forRoot(), ProductModule, OrderModule],
  providers: [ProductPopularityScheduler, OrderExpirationScheduler],
})
export class SchedulerModule {}
