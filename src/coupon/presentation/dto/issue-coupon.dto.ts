import { IssueCouponCommand } from '@/coupon/application/dto/issue-coupon.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

/**
 * 쿠폰 발급 요청 DTO
 */
export class IssueCouponRequest {
  @ApiProperty({
    description: '사용자 ID',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  userId: number;

  static toCommand(
    couponId: number,
    dto: IssueCouponRequest,
  ): IssueCouponCommand {
    const command = new IssueCouponCommand();
    command.userId = dto.userId;
    command.couponId = couponId;
    return command;
  }
}

/**
 * 쿠폰 발급 응답 DTO
 */
export class IssueCouponResponse {
  @ApiProperty({ description: '사용자 쿠폰 ID' })
  userCouponId: number;

  @ApiProperty({ description: '쿠폰 이름' })
  couponName: string;

  @ApiProperty({ description: '할인율 (%)' })
  discountRate: number;

  @ApiProperty({ description: '만료 시각' })
  expiredAt: Date;
}
