import { ErrorCode } from '@domain/common/constants/error-code';
import {
  DomainException,
  ValidationException,
} from '@domain/common/exceptions/domain.exception';
import {
  UserBalanceChangeLog,
  BalanceChangeCode,
} from './user-balance-change-log.entity';

/**
 * User Entity
 */
export class User {
  constructor(
    public readonly id: number,
    public balance: number,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public version: number = 1, // 낙관적 잠금 (기본값: 1)
  ) {
    this.validateBalance();
  }

  private validateBalance(): void {
    if (this.balance < 0 || !Number.isInteger(this.balance)) {
      throw new DomainException(ErrorCode.INVALID_USER_BALANCE);
    }
  }

  /**
   * 잔액 충전 및 로그 생성
   * RF-021: 시스템은 사용자 잔액이 변경될 때마다 잔액 변경 로그를 기록해야 한다
   * BR-021: amount는 0이 될 수 없으며, 증액은 양수(+)로 기록한다
   */
  charge(
    amount: number,
    refId?: number,
    note?: string,
  ): { user: User; log: UserBalanceChangeLog } {
    if (amount <= 0) {
      throw new DomainException(ErrorCode.INVALID_AMOUNT);
    }

    const beforeAmount = this.balance;
    this.balance += amount;
    const afterAmount = this.balance;
    this.updatedAt = new Date();

    this.validateBalance();

    const log = new UserBalanceChangeLog(
      0, // ID는 나중에 할당
      this.id,
      amount,
      beforeAmount,
      afterAmount,
      BalanceChangeCode.SYSTEM_CHARGE,
      note ?? null,
      refId ?? null,
      new Date(),
    );

    return { user: this, log };
  }

  /**
   * 잔액 차감 및 로그 생성
   * BR-011: 주문 총액이 사용자 잔액을 초과할 수 없다
   * RF-021: 시스템은 사용자 잔액이 변경될 때마다 잔액 변경 로그를 기록해야 한다
   * BR-021: amount는 0이 될 수 없으며, 차감은 음수(-)로 기록한다
   */
  deduct(
    amount: number,
    refId?: number,
    note?: string,
  ): { user: User; log: UserBalanceChangeLog } {
    if (amount <= 0) {
      throw new DomainException(ErrorCode.INVALID_AMOUNT);
    }
    if (this.balance < amount) {
      throw new DomainException(ErrorCode.INSUFFICIENT_BALANCE);
    }

    const beforeAmount = this.balance;
    this.balance -= amount;
    const afterAmount = this.balance;
    this.updatedAt = new Date();

    this.validateBalance();

    const log = new UserBalanceChangeLog(
      0, // ID는 나중에 할당
      this.id,
      -amount,
      beforeAmount,
      afterAmount,
      BalanceChangeCode.PAYMENT,
      note ?? null,
      refId ?? null,
    );

    return { user: this, log };
  }
}
