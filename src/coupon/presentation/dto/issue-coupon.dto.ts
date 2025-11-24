import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

/**
 * 쿠폰 발급 요청 DTO
 */
export class IssueCouponRequestDto {
  @ApiProperty({
    description: '사용자 ID',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  userId: number;
}

/**
 * 쿠폰 발급 응답 DTO
 */
export class IssueCouponResponseDto {
  @ApiProperty({ description: '사용자 쿠폰 ID' })
  userCouponId: number;

  @ApiProperty({ description: '쿠폰 이름' })
  couponName: string;

  @ApiProperty({ description: '할인율 (%)' })
  discountRate: number;

  @ApiProperty({ description: '만료 시각' })
  expiredAt: Date;
}
