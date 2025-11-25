import { User } from '@/user/domain/entities/user.entity';
import { BalanceChangeCode } from '@/user/domain/entities/user-balance-change-log.entity';
import { ErrorCode, DomainException } from '@common/exception';
describe('User Entity', () => {
  describe('생성자', () => {
    it('유효한 값으로 User를 생성한다', () => {
      // given
      const id = 1;
      const balance = 10000;
      const createdAt = new Date();
      const updatedAt = new Date();

      // when
      const user = new User(id, balance, createdAt, updatedAt);

      // then
      expect(user.id).toBe(id);
      expect(user.balance).toBe(balance);
      expect(user.createdAt).toBe(createdAt);
      expect(user.updatedAt).toBe(updatedAt);
    });

    it('잔액이 0이면 정상적으로 생성된다', () => {
      // given
      const zeroBalance = 0;

      // when
      const user = new User(1, zeroBalance);

      // then
      expect(user.balance).toBe(0);
    });

    it('잔액이 음수이면 INVALID_USER_BALANCE 예외를 던진다', () => {
      // given
      const invalidBalance = -1000;

      // when & then
      expect(() => new User(1, invalidBalance)).toThrow(DomainException);

      try {
        new User(1, invalidBalance);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_USER_BALANCE,
        );
      }
    });

    it('잔액이 정수가 아니면 INVALID_USER_BALANCE 예외를 던진다', () => {
      // given
      const invalidBalance = 1000.5;

      // when & then
      expect(() => new User(1, invalidBalance)).toThrow(DomainException);

      try {
        new User(1, invalidBalance);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_USER_BALANCE,
        );
      }
    });
  });

  describe('charge', () => {
    it('잔액을 충전하고 사용자와 로그를 반환한다', () => {
      // given
      const user = new User(1, 10000);
      const chargeAmount = 5000;

      // when
      const result = user.charge(chargeAmount);

      // then
      expect(result.user.balance).toBe(15000); // 10000 + 5000
      expect(result.log.userId).toBe(1);
      expect(result.log.amount).toBe(5000);
      expect(result.log.beforeAmount).toBe(10000);
      expect(result.log.afterAmount).toBe(15000);
      expect(result.log.code).toBe(BalanceChangeCode.SYSTEM_CHARGE);
    });

    it('충전 후 updatedAt이 갱신된다', () => {
      // given
      const user = new User(1, 10000);
      const originalUpdatedAt = user.updatedAt;

      // when
      user.charge(5000);

      // then
      expect(user.updatedAt).not.toBe(originalUpdatedAt);
      expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });

    it('refId와 note를 포함하여 충전할 수 있다', () => {
      // given
      const user = new User(1, 10000);
      const chargeAmount = 5000;
      const refId = 100;
      const note = '테스트 충전';

      // when
      const result = user.charge(chargeAmount, refId, note);

      // then
      expect(result.log.refId).toBe(refId);
      expect(result.log.note).toBe(note);
    });

    it('충전 금액이 0이면 INVALID_AMOUNT 예외를 던진다', () => {
      // given
      const user = new User(1, 10000);
      const invalidAmount = 0;

      // when & then
      expect(() => user.charge(invalidAmount)).toThrow(DomainException);

      try {
        user.charge(invalidAmount);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_AMOUNT,
        );
      }
    });

    it('충전 금액이 음수이면 INVALID_AMOUNT 예외를 던진다', () => {
      // given
      const user = new User(1, 10000);
      const invalidAmount = -5000;

      // when & then
      expect(() => user.charge(invalidAmount)).toThrow(DomainException);

      try {
        user.charge(invalidAmount);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_AMOUNT,
        );
      }
    });
  });

  describe('deduct', () => {
    it('잔액을 차감하고 사용자와 로그를 반환한다', () => {
      // given
      const user = new User(1, 10000);
      const deductAmount = 3000;

      // when
      const result = user.deduct(deductAmount);

      // then
      expect(result.user.balance).toBe(7000); // 10000 - 3000
      expect(result.log.userId).toBe(1);
      expect(result.log.amount).toBe(-3000); // 음수로 기록
      expect(result.log.beforeAmount).toBe(10000);
      expect(result.log.afterAmount).toBe(7000);
      expect(result.log.code).toBe(BalanceChangeCode.PAYMENT);
    });

    it('차감 후 updatedAt이 갱신된다', () => {
      // given
      const user = new User(1, 10000);
      const originalUpdatedAt = user.updatedAt;

      // when
      user.deduct(3000);

      // then
      expect(user.updatedAt).not.toBe(originalUpdatedAt);
      expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });

    it('refId와 note를 포함하여 차감할 수 있다', () => {
      // given
      const user = new User(1, 10000);
      const deductAmount = 3000;
      const refId = 200;
      const note = '주문 결제';

      // when
      const result = user.deduct(deductAmount, refId, note);

      // then
      expect(result.log.refId).toBe(refId);
      expect(result.log.note).toBe(note);
    });

    it('차감 금액이 0이면 INVALID_AMOUNT 예외를 던진다', () => {
      // given
      const user = new User(1, 10000);
      const invalidAmount = 0;

      // when & then
      expect(() => user.deduct(invalidAmount)).toThrow(DomainException);

      try {
        user.deduct(invalidAmount);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_AMOUNT,
        );
      }
    });

    it('차감 금액이 음수이면 INVALID_AMOUNT 예외를 던진다', () => {
      // given
      const user = new User(1, 10000);
      const invalidAmount = -3000;

      // when & then
      expect(() => user.deduct(invalidAmount)).toThrow(DomainException);

      try {
        user.deduct(invalidAmount);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_AMOUNT,
        );
      }
    });

    it('잔액이 부족하면 INSUFFICIENT_BALANCE 예외를 던진다', () => {
      // given
      const user = new User(1, 10000);
      const excessiveAmount = 15000;

      // when & then
      expect(() => user.deduct(excessiveAmount)).toThrow(DomainException);

      try {
        user.deduct(excessiveAmount);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INSUFFICIENT_BALANCE,
        );
      }
    });

    it('잔액과 동일한 금액을 차감할 수 있다', () => {
      // given
      const user = new User(1, 10000);

      // when
      const result = user.deduct(10000);

      // then
      expect(result.user.balance).toBe(0);
    });
  });
});
