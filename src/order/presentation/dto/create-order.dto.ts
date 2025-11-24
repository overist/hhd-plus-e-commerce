import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsPositive,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * 주문 항목 DTO
 */
export class OrderItemDto {
  @ApiProperty({
    description: '상품 옵션 ID',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  productOptionId: number;

  @ApiProperty({
    description: '주문 수량',
    example: 2,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;
}

/**
 * 주문서 생성 요청 DTO
 */
export class CreateOrderRequestDto {
  @ApiProperty({
    description: '사용자 ID',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  userId: number;

  @ApiProperty({
    description: '주문 상품 목록',
    type: [OrderItemDto],
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

/**
 * 주문 항목 응답 DTO
 */
export class OrderItemResponseDto {
  @ApiProperty({ description: '주문 항목 ID' })
  orderItemId: number;

  @ApiProperty({ description: '상품 ID' })
  productId?: number;

  @ApiProperty({ description: '상품명' })
  productName: string;

  @ApiProperty({ description: '상품 옵션 ID' })
  productOptionId: number;

  @ApiProperty({ description: '가격' })
  price: number;

  @ApiProperty({ description: '수량' })
  quantity: number;

  @ApiProperty({ description: '소계' })
  subtotal: number;
}

/**
 * 주문서 생성 응답 DTO
 */
export class CreateOrderResponseDto {
  @ApiProperty({ description: '주문 ID' })
  orderId: number;

  @ApiProperty({ description: '사용자 ID' })
  userId: number;

  @ApiProperty({ description: '주문 항목 목록', type: [OrderItemResponseDto] })
  items: OrderItemResponseDto[];

  @ApiProperty({ description: '총 주문 금액' })
  totalAmount: number;

  @ApiProperty({ description: '주문 상태' })
  status: string;

  @ApiProperty({ description: '주문 생성 시각' })
  createdAt: Date;

  @ApiProperty({ description: '주문서 만료 시각' })
  expiresAt: Date;
}
