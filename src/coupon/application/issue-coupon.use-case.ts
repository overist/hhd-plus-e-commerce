import { Injectable } from '@nestjs/common';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import {
  CouponRedisService,
  CouponIssueResult,
} from '@/coupon/infrastructure/coupon.redis.service';
import { IssueCouponCommand, IssueCouponResult } from './dto/issue-coupon.dto';
import { ErrorCode, ApplicationException } from '@common/exception';

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
  async execute(cmd: IssueCouponCommand): Promise<IssueCouponResult> {
    // Redis Lua 스크립트로 원자적 발급 처리
    const result = await this.couponRedisService.issueCoupon(
      cmd.userId,
      cmd.couponId,
    );

    // 에러 처리
    if (!result.success) {
      this.throwApplicationException(result);
    }

    // 쿠폰 정보 조회 (응답용)
    const coupon = await this.couponService.getCoupon(cmd.couponId);

    return IssueCouponResult.fromRedisResult(result, coupon);
  }

  /**
   * Redis 발급 결과를 애플리케이션 예외로 변환
   */
  private throwApplicationException(result: CouponIssueResult): never {
    switch (result.errorCode) {
      case 'COUPON_NOT_FOUND':
        throw new ApplicationException(ErrorCode.COUPON_NOT_FOUND);
      case 'ALREADY_ISSUED':
        throw new ApplicationException(ErrorCode.ALREADY_ISSUED);
      case 'COUPON_SOLD_OUT':
        throw new ApplicationException(ErrorCode.COUPON_SOLD_OUT);
      case 'EXPIRED_COUPON':
        throw new ApplicationException(ErrorCode.EXPIRED_COUPON);
      default:
        throw new ApplicationException(ErrorCode.COUPON_NOT_FOUND);
    }
  }
}
