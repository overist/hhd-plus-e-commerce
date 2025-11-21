import { Module } from '@nestjs/common';
import { CouponFacade } from '@application/facades/coupon.facade';
import { CouponDomainService } from '@domain/coupon/coupon.service';
import {
  ICouponRepository,
  IUserCouponRepository,
} from '@domain/interfaces/coupon.repository.interface';
import {
  CouponRepository,
  UserCouponRepository,
} from '@infrastructure/repositories/prisma/coupon.repository';
import { CouponController } from '@presentation/coupon/coupon.controller';

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

    // Domain Service
    CouponDomainService,

    // Facade
    CouponFacade,
  ],
  exports: [CouponDomainService, ICouponRepository, IUserCouponRepository],
})
export class CouponModule {}
