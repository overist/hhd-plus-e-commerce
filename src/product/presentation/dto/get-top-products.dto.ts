import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  GetTopProductsQuery,
  GetTopProductsResult,
} from '@/product/application/dto/get-top-products.dto';

/**
 * 인기 상품 조회 요청 DTO
 */
export class GetTopProductsRequest {
  @ApiProperty({
    description: '조회할 인기 상품 개수',
    example: 5,
    required: false,
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  count?: number = 5;

  @ApiProperty({
    description: '조회할 기간(일)',
    example: 3,
    required: false,
    default: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dateRangeDays?: number = 3;

  static toQuery(dto: GetTopProductsRequest): GetTopProductsQuery {
    const query = new GetTopProductsQuery();
    query.count = dto.count ?? 5;
    query.dateRangeDays = dto.dateRangeDays ?? 3;
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
