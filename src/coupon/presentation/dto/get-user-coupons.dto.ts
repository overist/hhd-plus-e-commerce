import { ApiProperty } from '@nestjs/swagger';

/**
 * 쿠폰 정보 DTO
 */
export class CouponViewDto {
  @ApiProperty({ description: '사용자 쿠폰 ID' })
  userCouponId: number;

  @ApiProperty({ description: '쿠폰 이름' })
  couponName: string;

  @ApiProperty({ description: '할인율 (%)' })
  discountRate: number;

  @ApiProperty({ description: '만료 시각' })
  expiredAt: Date;
}

/**
 * 보유 쿠폰 조회 응답 DTO
 */
export class GetUserCouponsResponseDto {
  @ApiProperty({
    description: '쿠폰 목록',
    type: [CouponViewDto],
  })
  coupons: CouponViewDto[];
}
