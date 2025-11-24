import { ApiProperty } from '@nestjs/swagger';

/**
 * 장바구니 항목 DTO
 */
export class CartViewDto {
  @ApiProperty({ description: '장바구니 항목 ID' })
  cartItemId: number;

  @ApiProperty({ description: '상품 ID' })
  productId: number;

  @ApiProperty({ description: '상품명' })
  productName: string;

  @ApiProperty({ description: '상품 옵션 ID' })
  productOptionId: number;

  @ApiProperty({ description: '옵션 색상', nullable: true })
  productOptionColor: string | null;

  @ApiProperty({ description: '옵션 사이즈', nullable: true })
  productOptionSize: string | null;

  @ApiProperty({ description: '가격' })
  price: number;

  @ApiProperty({ description: '수량' })
  quantity: number;
}

/**
 * 장바구니 조회 응답 DTO
 */
export class GetCartResponseDto {
  @ApiProperty({
    description: '장바구니 항목 목록',
    type: [CartViewDto],
  })
  items: CartViewDto[];
}
