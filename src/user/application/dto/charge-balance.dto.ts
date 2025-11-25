import { User } from '@/user/domain/entities/user.entity';

/**
 * 애플리케이션 레이어 DTO: ChargeBalance 요청
 */
export class ChargeBalanceCommand {
  userId: number;
  amount: number;
}

/**
 * 애플리케이션 레이어 DTO: ChargeBalance 응답
 */
export class ChargeBalanceResult {
  userId: number;
  balance: number;

  static fromDomain(user: User): ChargeBalanceResult {
    const result = new ChargeBalanceResult();
    result.userId = user.id;
    result.balance = user.balance;
    return result;
  }
}
