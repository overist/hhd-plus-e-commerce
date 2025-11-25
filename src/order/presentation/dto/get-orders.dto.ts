import {
  GetOrdersQuery,
  GetOrdersResult,
} from '@/order/application/dto/get-orders.dto';
import {
  GetOrderDetailQuery,
  GetOrderDetailResult,
} from '@/order/application/dto/get-order-detail.dto';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 주문 내역 조회 요청 DTO
 */
export class GetOrdersRequest {
  static toQuery(userId: number): GetOrdersQuery {
    const query = new GetOrdersQuery();
    query.userId = userId;
    return query;
  }
}

/**
 * 주문 항목 DTO (조회용)
 */
export class OrderItemDetailDto {
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
 * 주문 목록 DTO
 */
export class OrderListDto {
  @ApiProperty({ description: '주문 ID' })
  orderId: number;

  @ApiProperty({ description: '총 주문 금액' })
  totalAmount: number;

  @ApiProperty({ description: '할인 금액' })
  discountAmount: number;

  @ApiProperty({ description: '최종 결제 금액' })
  finalAmount: number;

  @ApiProperty({ description: '주문 상태' })
  status: string;

  @ApiProperty({ description: '주문 생성 시각' })
  createdAt: Date;

  @ApiProperty({ description: '결제 완료 시각', nullable: true })
  paidAt: Date | null;
}

/**
 * 주문 내역 조회 응답 DTO
 */
export class GetOrdersResponse {
  @ApiProperty({
    description: '주문 목록',
    type: [OrderListDto],
  })
  orders: OrderListDto[];

  static fromResult(results: GetOrdersResult[]): GetOrdersResponse {
    const response = new GetOrdersResponse();
    response.orders = results.map((result) => ({
      orderId: result.orderId,
      totalAmount: result.totalAmount,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
      status: result.status,
      createdAt: result.createdAt,
      paidAt: result.paidAt,
    }));
    return response;
  }
}

/**
 * 주문 상세 조회 요청 DTO
 */
export class GetOrderDetailRequest {
  static toQuery(orderId: number): GetOrderDetailQuery {
    const query = new GetOrderDetailQuery();
    query.orderId = orderId;
    return query;
  }
}

/**
 * 주문 상세 정보 DTO
 */
export class OrderDetailDto {
  @ApiProperty({ description: '주문 ID' })
  orderId: number;

  @ApiProperty({ description: '사용자 ID' })
  userId: number;

  @ApiProperty({ description: '주문 항목 목록', type: [OrderItemDetailDto] })
  items: OrderItemDetailDto[];

  @ApiProperty({ description: '총 주문 금액' })
  totalAmount: number;

  @ApiProperty({ description: '할인 금액' })
  discountAmount: number;

  @ApiProperty({ description: '최종 결제 금액' })
  finalAmount: number;

  @ApiProperty({ description: '주문 상태' })
  status: string;

  @ApiProperty({ description: '주문 생성 시각' })
  createdAt: Date;

  @ApiProperty({ description: '결제 완료 시각', nullable: true })
  paidAt: Date | null;
}

/**
 * 주문 상세 조회 응답 DTO
 */
export class GetOrderDetailResponse {
  @ApiProperty({ description: '주문 상세 정보', type: OrderDetailDto })
  orderDetail: OrderDetailDto;

  static fromResult(result: GetOrderDetailResult): GetOrderDetailResponse {
    const response = new GetOrderDetailResponse();
    response.orderDetail = {
      orderId: result.orderId,
      userId: result.userId,
      items: result.items,
      totalAmount: result.totalAmount,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
      status: result.status,
      createdAt: result.createdAt,
      paidAt: result.paidAt,
    };
    return response;
  }
}
