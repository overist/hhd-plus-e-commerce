import { ApiProperty } from '@nestjs/swagger';

/**
 * 잔액 조회 응답 DTO
 */
export class GetBalanceResponseDto {
  @ApiProperty({ description: '사용자 ID' })
  userId: number;

  @ApiProperty({ description: '현재 잔액' })
  balance: number;
}
