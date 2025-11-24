import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

/**
 * 결제 처리 요청 DTO
 */
export class ProcessPaymentRequestDto {
  @ApiProperty({
    description: '사용자 ID',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  userId: number;

  @ApiPropertyOptional({
    description: '사용할 쿠폰 ID (선택)',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  @IsOptional()
  userCouponId?: number;
}

/**
 * 결제 처리 응답 DTO
 */
export class ProcessPaymentResponseDto {
  @ApiProperty({ description: '주문 ID' })
  orderId: number;

  @ApiProperty({ description: '주문 상태' })
  status: string;

  @ApiProperty({ description: '결제 금액' })
  paidAmount: number;

  @ApiProperty({ description: '잔여 잔액' })
  remainingBalance: number;

  @ApiProperty({ description: '결제 완료 시각' })
  paidAt: Date;
}
