import { Module } from '@nestjs/common';
import { IssueCouponUseCase } from '@/coupon/application/issue-coupon.use-case';
import { GetUserCouponsUseCase } from '@/coupon/application/get-user-coupons.use-case';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import {
  ICouponRepository,
  IUserCouponRepository,
} from '@/coupon/domain/interfaces/coupon.repository.interface';
import {
  CouponPrismaRepository,
  UserCouponRepository,
} from '@/coupon/infrastructure/coupon.prisma.repository';
import { CouponController } from '@/coupon/presentation/coupon.controller';

/**
 * Coupon Module
 * 쿠폰 관리 모듈
 */
@Module({
  controllers: [CouponController],
  providers: [
    // Coupon Repositories
    CouponPrismaRepository,
    {
      provide: ICouponRepository,
      useClass: CouponPrismaRepository,
    },
    UserCouponRepository,
    {
      provide: IUserCouponRepository,
      useClass: UserCouponRepository,
    },

    // Domain Service
    CouponDomainService,

    // UseCase
    IssueCouponUseCase,
    GetUserCouponsUseCase,
  ],
  exports: [CouponDomainService, ICouponRepository, IUserCouponRepository],
})
export class CouponModule {}
