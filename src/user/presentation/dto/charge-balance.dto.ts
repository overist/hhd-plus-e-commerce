import { ChargeBalanceCommand } from '@/user/application/dto/charge-balance.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/**
 * 잔액 충전 요청 DTO
 */
export class ChargeBalanceRequest {
  @ApiProperty({
    description: '충전 금액',
    example: 10000,
    minimum: 1,
  })
  @IsInt()
  @Min(1, { message: '충전 금액은 1 이상이어야 합니다' })
  amount: number;

  static toCommand(
    userId: number,
    dto: ChargeBalanceRequest,
  ): ChargeBalanceCommand {
    const command = new ChargeBalanceCommand();
    command.userId = userId;
    command.amount = dto.amount;
    return command;
  }
}

/**
 * 잔액 충전 응답 DTO
 */
export class ChargeBalanceResponse {
  @ApiProperty({ description: '사용자 ID' })
  userId: number;

  @ApiProperty({ description: '충전 후 잔액' })
  balance: number;
}
