import { ApiProperty } from '@nestjs/swagger';
import {
  GetProductsQuery,
  GetProductsResult,
} from '@/product/application/dto/get-products.dto';

/**
 * 상품 목록 조회 요청 DTO
 */
export class GetProductsRequest {
  static toQuery(): GetProductsQuery {
    return new GetProductsQuery();
  }
}

/**
 * 상품 목록 조회 응답 DTO
 */
export class GetProductsResponse {
  @ApiProperty({
    description: '상품 목록',
    type: [GetProductsResult],
  })
  data: GetProductsResult[];
}
