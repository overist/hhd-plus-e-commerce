import { ApiProperty } from '@nestjs/swagger';
import {
  GetCartQuery,
  GetCartResult,
} from '@/cart/application/dto/get-cart.dto';

export class GetCartRequest {
  @ApiProperty({ description: '사용자 ID' })
  userId: number;

  static toQuery(userId: number, dto: GetCartRequest): GetCartQuery {
    const query = new GetCartQuery();
    query.userId = userId;
    return query;
  }
}

/**
 * 장바구니 조회 응답 DTO
 */
export class GetCartResponse {
  @ApiProperty({
    description: '장바구니 항목 목록',
    type: [GetCartResult],
  })
  data: GetCartResult[];
}
