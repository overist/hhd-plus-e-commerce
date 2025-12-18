import { Module } from '@nestjs/common';
import { IssueCouponUseCase } from '@/coupon/application/issue-coupon.use-case';
import { GetUserCouponsUseCase } from '@/coupon/application/get-user-coupons.use-case';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import {
  ICouponRepository,
  IUserCouponRepository,
} from '@/coupon/domain/interfaces/coupon.repository.interface';
import {
  CouponRepository,
  UserCouponRepository,
} from '@/coupon/infrastructure/coupon.repository';
import { CouponRedisService } from '@/coupon/infrastructure/coupon.redis.service';
import { CouponController } from '@/coupon/presentation/coupon.controller';
import { CouponKafkaProducer } from '@/coupon/infrastructure/coupon.kafka.producer';
import { CouponOrderProcessingKafkaConsumer } from '@/coupon/presentation/consumers/order-processing.kafka.consumer';
import { CouponOrderProcessingFailKafkaConsumer } from '@/coupon/presentation/consumers/order-processing-fail.kafka.consumer';
import { CouponOrderPaymentFailKafkaConsumer } from '@/coupon/presentation/consumers/order-payment-fail.kafka.consumer';

/**
 * Coupon Module
 * 쿠폰 관리 모듈
 */
@Module({
  controllers: [CouponController],
  providers: [
    // Coupon Repositories
    CouponRepository,
    {
      provide: ICouponRepository,
      useClass: CouponRepository,
    },
    UserCouponRepository,
    {
      provide: IUserCouponRepository,
      useClass: UserCouponRepository,
    },

    // Infrastructure Service (Redis)
    CouponRedisService,

    // Domain Service
    CouponDomainService,

    // UseCase
    IssueCouponUseCase,
    GetUserCouponsUseCase,

    // Kafka Producer/Consumers
    CouponKafkaProducer,
    CouponOrderProcessingKafkaConsumer,
    CouponOrderProcessingFailKafkaConsumer,
    CouponOrderPaymentFailKafkaConsumer,
  ],
  exports: [
    CouponDomainService,
    CouponRedisService,
    ICouponRepository,
    IUserCouponRepository,
  ],
})
export class CouponModule {}
