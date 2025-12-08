import { Injectable } from '@nestjs/common';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import { CouponRedisService } from '@/coupon/infrastructure/coupon.redis.service';
import { IssueCouponCommand, IssueCouponResult } from './dto/issue-coupon.dto';

@Injectable()
export class IssueCouponUseCase {
  constructor(
    // Dependency Injection
    private readonly couponService: CouponDomainService,
    private readonly couponRedisService: CouponRedisService,
  ) {}

  /**
   * ANCHOR 쿠폰 발급
   * - Redis Lua 스크립트로 원자성 보장 (중복 체크 + 재고 차감 + UserCoupon 생성)
   * - DB에는 저장하지 않음 (쿠폰 사용 시 DB 동기화)
   */
  async issueCoupon(cmd: IssueCouponCommand): Promise<IssueCouponResult> {
    // Redis Lua 스크립트로 원자적 발급 처리
    const userCoupon = await this.couponRedisService.issueCoupon(
      cmd.userId,
      cmd.couponId,
    );

    // 쿠폰 정보 조회 (응답용)
    const coupon = await this.couponRedisService.getCachedCoupon(cmd.couponId);

    return IssueCouponResult.fromDomain(userCoupon, coupon);
  }
}
