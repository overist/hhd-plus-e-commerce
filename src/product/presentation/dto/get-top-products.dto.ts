import { ApiProperty } from '@nestjs/swagger';

/**
 * 인기 상품 DTO
 */
export class TopProductDto {
  @ApiProperty({ description: '순위' })
  rank: number;

  @ApiProperty({ description: '상품 ID' })
  productId: number;

  @ApiProperty({ description: '상품명' })
  name: string;

  @ApiProperty({ description: '가격' })
  price: number;

  @ApiProperty({ description: '카테고리' })
  category: string;

  @ApiProperty({ description: '판매 수량' })
  salesCount: number;
}

/**
 * 인기 상품 조회 응답 DTO
 */
export class GetTopProductsResponseDto {
  @ApiProperty({
    description: '인기 상품 목록',
    type: [TopProductDto],
  })
  products: TopProductDto[];
}
