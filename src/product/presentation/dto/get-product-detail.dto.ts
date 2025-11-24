import { ApiProperty } from '@nestjs/swagger';

/**
 * 상품 옵션 DTO
 */
export class ProductOptionDto {
  @ApiProperty({ description: '상품 옵션 ID' })
  productOptionId: number;

  @ApiProperty({ description: '색상', nullable: true })
  color: string | null;

  @ApiProperty({ description: '사이즈', nullable: true })
  size: string | null;

  @ApiProperty({ description: '재고 수량' })
  stock: number;
}

/**
 * 상품 상세 DTO
 */
export class ProductDetailDto {
  @ApiProperty({ description: '상품 ID' })
  productId: number;

  @ApiProperty({ description: '상품명' })
  name: string;

  @ApiProperty({ description: '가격' })
  price: number;

  @ApiProperty({ description: '카테고리' })
  category: string;

  @ApiProperty({ description: '상품 설명' })
  description: string;

  @ApiProperty({ description: '판매 가능 여부' })
  isAvailable: boolean;
}

/**
 * 상품 상세 조회 응답 DTO
 */
export class GetProductDetailResponseDto {
  @ApiProperty({ description: '상품 정보' })
  product: ProductDetailDto;

  @ApiProperty({
    description: '상품 옵션 목록',
    type: [ProductOptionDto],
  })
  options: ProductOptionDto[];
}
