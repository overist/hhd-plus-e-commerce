import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, Min } from 'class-validator';

/**
 * 장바구니 추가 요청 DTO
 */
export class AddCartRequestDto {
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
}
