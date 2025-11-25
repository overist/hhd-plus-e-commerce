import { ApiProperty } from '@nestjs/swagger';
import {
  GetTopProductsQuery,
  GetTopProductsResult,
} from '@/product/application/dto/get-top-products.dto';

/**
 * 인기 상품 조회 요청 DTO
 */
export class GetTopProductsRequest {
  static toQuery(count: number): GetTopProductsQuery {
    const query = new GetTopProductsQuery();
    query.count = count;
    return query;
  }
}

/**
 * 인기 상품 조회 응답 DTO
 */
export class GetTopProductsResponse {
  @ApiProperty({
    description: '인기 상품 목록',
    type: [GetTopProductsResult],
  })
  data: GetTopProductsResult[];
}
