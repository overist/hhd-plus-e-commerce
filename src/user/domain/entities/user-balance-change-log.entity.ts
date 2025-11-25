import { ErrorCode, DomainException } from '@common/exception';

/**
 * UserBalanceChangeLog Entity
 * 잔액 변경 이력 (Append-only)
 */
export class UserBalanceChangeLog {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly amount: number,
    public readonly beforeAmount: number,
    public readonly afterAmount: number,
    public readonly code: BalanceChangeCode,
    public readonly note: string | null,
    public readonly refId: number | null,
    public readonly createdAt: Date = new Date(),
  ) {
    this.validate();
  }

  private validate(): void {
    // BR-021: amount는 0이 될 수 없음
    if (this.amount === 0) {
      throw new DomainException(ErrorCode.INVALID_AMOUNT);
    }
    if (this.beforeAmount < 0 || this.afterAmount < 0) {
      throw new DomainException(ErrorCode.INVALID_AMOUNT);
    }
    // BR-022: after_amount = before_amount + amount
    if (this.afterAmount !== this.beforeAmount + this.amount) {
      throw new DomainException(ErrorCode.USER_LOG_INVALID_CALCULATION);
    }
  }
}

/**
 * 잔액 변경 유형 코드
 * BR-023: 애플리케이션에서 허용된 값만 사용
 * - SYSTEM_CHARGE: 관리자/시스템에 의한 충전
 * - PAYMENT: 주문 결제 차감
 * - REFUND: 결제 취소/환불에 의한 잔액 복원
 * - ADJUST: 관리자에 의한 조정
 */
export enum BalanceChangeCode {
  SYSTEM_CHARGE = 'SYSTEM_CHARGE', // 관리자/시스템 충전
  PAYMENT = 'PAYMENT', // 주문 결제 차감
  ADJUST = 'ADJUST', // 관리자 조정
}
