import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsPositive } from 'class-validator';
import { UpdateStockCommand } from '@/product/application/dto/update-stock.dto';

/**
 * 재고 수정 요청 DTO
 */
export class UpdateStockRequest {
  @ApiProperty({
    description: '재고 수량 변경 타입',
    enum: ['increase', 'decrease'],
    example: 'increase',
  })
  @IsEnum(['increase', 'decrease'])
  operation: 'increase' | 'decrease';

  @ApiProperty({
    description: '변경할 수량',
    example: 10,
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  quantity: number;

  static toCommand(
    productOptionId: number,
    dto: UpdateStockRequest,
  ): UpdateStockCommand {
    const command = new UpdateStockCommand();
    command.productOptionId = productOptionId;
    command.operation = dto.operation;
    command.quantity = dto.quantity;
    return command;
  }
}

/**
 * 재고 수정 응답 DTO (void)
 */
export class UpdateStockResponse {}
