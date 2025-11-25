import { GetBalanceQuery } from '@/user/application/dto/get-balance.dto';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 잔액 조회 요청 DTO
 */
export class GetBalanceRequest {
  @ApiProperty({ description: '사용자 ID' })
  userId: number;

  static toQuery(userId: number): GetBalanceQuery {
    const query = new GetBalanceQuery();
    query.userId = userId;
    return query;
  }
}

/**
 * 잔액 조회 응답 DTO
 */
export class GetBalanceResponse {
  @ApiProperty({ description: '사용자 ID' })
  userId: number;

  @ApiProperty({ description: '현재 잔액' })
  balance: number;
}
