import { AddCartCommand } from '@/cart/application/dto/add-cart.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, Min } from 'class-validator';

/**
 * 장바구니 추가 요청 DTO
 */
export class AddCartRequest {
  @ApiProperty({
    description: '상품 옵션 ID',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  productOptionId: number;

  @ApiProperty({
    description: '수량',
    example: 2,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;

  static toCommand(userId: number, dto: AddCartRequest): AddCartCommand {
    const command = new AddCartCommand();
    command.userId = userId;
    command.productOptionId = dto.productOptionId;
    command.quantity = dto.quantity;
    return command;
  }
}

/**
 * 장바구니 추가 응답 DTO (void)
 */
export class AddCartResponse {}
