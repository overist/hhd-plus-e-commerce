import { ApiProperty } from '@nestjs/swagger';

/**
 * 상품 목록 조회 응답 DTO
 */
export class ProductDto {
  @ApiProperty({ description: '상품 ID' })
  productId: number;

  @ApiProperty({ description: '상품명' })
  name: string;

  @ApiProperty({ description: '가격' })
  price: number;

  @ApiProperty({ description: '카테고리' })
  category: string;

  @ApiProperty({ description: '판매 가능 여부' })
  isAvailable: boolean;
}

/**
 * 상품 목록 조회 응답 DTO
 */
export class GetProductsResponseDto {
  @ApiProperty({
    description: '상품 목록',
    type: [ProductDto],
  })
  products: ProductDto[];
}
