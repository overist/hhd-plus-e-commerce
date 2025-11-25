import { User } from '@/user/domain/entities/user.entity';

/**
 * 애플리케이션 레이어 DTO: GetBalance 요청
 */
export class GetBalanceQuery {
  userId: number;
}

/**
 * 애플리케이션 레이어 DTO: GetBalance 응답
 */
export class GetBalanceResult {
  userId: number;
  balance: number;

  static fromDomain(user: User): GetBalanceResult {
    const result = new GetBalanceResult();
    result.userId = user.id;
    result.balance = user.balance;
    return result;
  }
}
