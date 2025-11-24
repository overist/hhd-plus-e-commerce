import { User } from '@/user/domain/entities/user.entity';
import { UserBalanceChangeLog } from '@/user/domain/entities/user-balance-change-log.entity';

/**
 * User Repository Port
 * 사용자 데이터 접근 계약
 */
export abstract class IUserRepository {
  abstract findById(id: number): Promise<User | null>;
  abstract create(user: User): Promise<User>;
  abstract update(user: User): Promise<User>;
}

/**
 * UserBalanceChangeLog Repository Port
 * 사용자 잔액 변경 로그 데이터 접근 계약
 */
export abstract class IUserBalanceChangeLogRepository {
  abstract create(log: UserBalanceChangeLog): Promise<UserBalanceChangeLog>;
  abstract findByUserId(userId: number): Promise<UserBalanceChangeLog[]>;
}
