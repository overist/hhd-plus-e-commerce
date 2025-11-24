import { Module } from '@nestjs/common';
import { CouponFacade } from '@/coupon/application/coupon.facade';
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

    // Facade
    CouponFacade,
  ],
  exports: [CouponDomainService, ICouponRepository, IUserCouponRepository],
})
export class CouponModule {}
