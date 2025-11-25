import { Injectable } from '@nestjs/common';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import { IssueCouponCommand, IssueCouponResult } from './dto/issue-coupon.dto';

@Injectable()
export class IssueCouponUseCase {
  constructor(
    private readonly couponService: CouponDomainService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * ANCHOR 쿠폰 발급
   */
  async execute(cmd: IssueCouponCommand): Promise<IssueCouponResult> {
    return await this.prisma.runInTransaction(async () => {
      const coupon = await this.couponService.getCoupon(cmd.couponId);
      const issuedCoupon = await this.couponService.issueCouponToUser(
        cmd.userId,
        coupon,
      );

      return IssueCouponResult.fromDomain(issuedCoupon, coupon);
    });
  }
}
