import { ApiProperty } from '@nestjs/swagger';
import {
  GetProductDetailQuery,
  GetProductDetailResult,
} from '@/product/application/dto/get-product-detail.dto';

/**
 * 상품 상세 조회 요청 DTO
 */
export class GetProductDetailRequest {
  @ApiProperty({ description: '상품 ID' })
  productId: number;

  static toQuery(productId: number): GetProductDetailQuery {
    const query = new GetProductDetailQuery();
    query.productId = productId;
    return query;
  }
}

/**
 * 상품 상세 조회 응답 DTO
 */
export class GetProductDetailResponse {
  @ApiProperty({ description: '상품 상세 정보' })
  data: GetProductDetailResult;
}
