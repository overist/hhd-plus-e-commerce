import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

/**
 * 잔액 충전 요청 DTO
 */
export class ChargeBalanceRequestDto {
  @ApiProperty({ description: '충전 금액', example: 10000, minimum: 1 })
  @IsNumber()
  @Min(1, { message: '충전 금액은 1 이상이어야 합니다' })
  amount: number;
}

/**
 * 잔액 충전 응답 DTO
 */
export class ChargeBalanceResponseDto {
  @ApiProperty({ description: '사용자 ID' })
  userId: number;

  @ApiProperty({ description: '충전 후 잔액' })
  balance: number;
}
