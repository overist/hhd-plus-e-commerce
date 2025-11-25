import {
  CreateOrderCommand,
  OrderItemInput,
  CreateOrderResult,
} from '@/order/application/dto/create-order.dto';
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
 * 주문 항목 요청 DTO
 */
export class OrderItemRequestDto {
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
export class CreateOrderRequest {
  @ApiProperty({
    description: '사용자 ID',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  userId: number;

  @ApiProperty({
    description: '주문 상품 목록',
    type: [OrderItemRequestDto],
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemRequestDto)
  items: OrderItemRequestDto[];

  static toCommand(dto: CreateOrderRequest): CreateOrderCommand {
    const command = new CreateOrderCommand();
    command.userId = dto.userId;
    command.items = dto.items.map((item) => {
      const input = new OrderItemInput();
      input.productOptionId = item.productOptionId;
      input.quantity = item.quantity;
      return input;
    });
    return command;
  }
}

/**
 * 주문 항목 응답 DTO
 */
export class OrderItemResponseDto {
  @ApiProperty({ description: '주문 항목 ID' })
  orderItemId: number;

  @ApiProperty({ description: '상품 옵션 ID' })
  productOptionId: number;

  @ApiProperty({ description: '상품명' })
  productName: string;

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
export class CreateOrderResponse {
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

  static fromResult(result: CreateOrderResult): CreateOrderResponse {
    const response = new CreateOrderResponse();
    response.orderId = result.orderId;
    response.userId = result.userId;
    response.items = result.items;
    response.totalAmount = result.totalAmount;
    response.status = result.status;
    response.createdAt = result.createdAt;
    response.expiresAt = result.expiresAt;
    return response;
  }
}
