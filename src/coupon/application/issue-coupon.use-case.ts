import { Injectable } from '@nestjs/common';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import { IssueCouponCommand, IssueCouponResult } from './dto/issue-coupon.dto';
import { RedisLockService } from '@common/redis-lock-manager/redis.lock.service';

@Injectable()
export class IssueCouponUseCase {
  constructor(
    // Dependency Injection
    private readonly couponService: CouponDomainService,
    private readonly prisma: PrismaService,
    private readonly redisLockService: RedisLockService,
  ) {}

  /**
   * ANCHOR 쿠폰 발급
   */
  async execute(cmd: IssueCouponCommand): Promise<IssueCouponResult> {
    const lockKey = `coupon:issue:${cmd.couponId}`;

    return await this.redisLockService.withLock(lockKey, async () => {
      return await this.prisma.runInTransaction(async () => {
        const coupon = await this.couponService.getCoupon(cmd.couponId);
        const issuedCoupon = await this.couponService.issueCouponToUser(
          cmd.userId,
          coupon,
        );

        return IssueCouponResult.fromDomain(issuedCoupon, coupon);
      });
    });
  }
}
