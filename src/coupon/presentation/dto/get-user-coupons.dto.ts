import {
  GetUserCouponsQuery,
  GetUserCouponsResult,
} from '@/coupon/application/dto/get-user-coupons.dto';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 보유 쿠폰 조회 요청 DTO
 */
export class GetUserCouponsRequest {
  @ApiProperty({ description: '사용자 ID' })
  userId: number;

  static toQuery(userId: number): GetUserCouponsQuery {
    const query = new GetUserCouponsQuery();
    query.userId = userId;
    return query;
  }
}

/**
 * 보유 쿠폰 조회 응답 DTO
 */
export class GetUserCouponsResponse {
  @ApiProperty({
    description: '쿠폰 목록',
    type: [GetUserCouponsResult],
  })
  data: GetUserCouponsResult[];
}
