import {
  UserBalanceChangeLog,
  BalanceChangeCode,
} from '@/user/domain/entities/user-balance-change-log.entity';
import { ErrorCode, ValidationException } from '@common/exception';

describe('UserBalanceChangeLog Entity', () => {
  describe('생성자', () => {
    it('유효한 값으로 UserBalanceChangeLog를 생성한다', () => {
      // given
      const id = 1;
      const userId = 100;
      const amount = 5000;
      const beforeAmount = 10000;
      const afterAmount = 15000;
      const code = BalanceChangeCode.SYSTEM_CHARGE;
      const note = '테스트 충전';
      const refId = 1000;
      const createdAt = new Date();

      // when
      const log = new UserBalanceChangeLog(
        id,
        userId,
        amount,
        beforeAmount,
        afterAmount,
        code,
        note,
        refId,
        createdAt,
      );

      // then
      expect(log.id).toBe(id);
      expect(log.userId).toBe(userId);
      expect(log.amount).toBe(amount);
      expect(log.beforeAmount).toBe(beforeAmount);
      expect(log.afterAmount).toBe(afterAmount);
      expect(log.code).toBe(code);
      expect(log.note).toBe(note);
      expect(log.refId).toBe(refId);
      expect(log.createdAt).toBe(createdAt);
    });

    it('note와 refId가 null인 경우에도 생성된다', () => {
      // given
      const log = new UserBalanceChangeLog(
        1,
        100,
        5000,
        10000,
        15000,
        BalanceChangeCode.SYSTEM_CHARGE,
        null,
        null,
      );

      // then
      expect(log.note).toBeNull();
      expect(log.refId).toBeNull();
    });

    it('음수 금액으로 차감 로그를 생성할 수 있다', () => {
      // given
      const amount = -3000;
      const beforeAmount = 10000;
      const afterAmount = 7000;

      // when
      const log = new UserBalanceChangeLog(
        1,
        100,
        amount,
        beforeAmount,
        afterAmount,
        BalanceChangeCode.PAYMENT,
        null,
        null,
      );

      // then
      expect(log.amount).toBe(-3000);
      expect(log.code).toBe(BalanceChangeCode.PAYMENT);
    });

    it('amount가 0이면 INVALID_AMOUNT 예외를 던진다', () => {
      // given
      const invalidAmount = 0;

      // when & then
      expect(
        () =>
          new UserBalanceChangeLog(
            1,
            100,
            invalidAmount,
            10000,
            10000,
            BalanceChangeCode.SYSTEM_CHARGE,
            null,
            null,
          ),
      ).toThrow();

      try {
        new UserBalanceChangeLog(
          1,
          100,
          invalidAmount,
          10000,
          10000,
          BalanceChangeCode.SYSTEM_CHARGE,
          null,
          null,
        );
      } catch (error) {
        expect(error.name).toBe('ValidationException');
        expect((error as ValidationException).errorCode).toBe(
          ErrorCode.INVALID_AMOUNT,
        );
      }
    });

    it('beforeAmount가 음수이면 INVALID_AMOUNT 예외를 던진다', () => {
      // given
      const invalidBeforeAmount = -1000;

      // when & then
      expect(
        () =>
          new UserBalanceChangeLog(
            1,
            100,
            5000,
            invalidBeforeAmount,
            4000,
            BalanceChangeCode.SYSTEM_CHARGE,
            null,
            null,
          ),
      ).toThrow();

      try {
        new UserBalanceChangeLog(
          1,
          100,
          5000,
          invalidBeforeAmount,
          4000,
          BalanceChangeCode.SYSTEM_CHARGE,
          null,
          null,
        );
      } catch (error) {
        expect(error.name).toBe('ValidationException');
        expect((error as ValidationException).errorCode).toBe(
          ErrorCode.INVALID_AMOUNT,
        );
      }
    });

    it('afterAmount가 음수이면 INVALID_AMOUNT 예외를 던진다', () => {
      // given
      const invalidAfterAmount = -1000;

      // when & then
      expect(
        () =>
          new UserBalanceChangeLog(
            1,
            100,
            5000,
            10000,
            invalidAfterAmount,
            BalanceChangeCode.SYSTEM_CHARGE,
            null,
            null,
          ),
      ).toThrow();

      try {
        new UserBalanceChangeLog(
          1,
          100,
          5000,
          10000,
          invalidAfterAmount,
          BalanceChangeCode.SYSTEM_CHARGE,
          null,
          null,
        );
      } catch (error) {
        expect(error.name).toBe('ValidationException');
        expect((error as ValidationException).errorCode).toBe(
          ErrorCode.INVALID_AMOUNT,
        );
      }
    });

    it('afterAmount가 beforeAmount + amount와 일치하지 않으면 USER_LOG_INVALID_CALCULATION 예외를 던진다', () => {
      // given
      const beforeAmount = 10000;
      const amount = 5000;
      const invalidAfterAmount = 20000; // 올바른 값은 15000

      // when & then
      expect(
        () =>
          new UserBalanceChangeLog(
            1,
            100,
            amount,
            beforeAmount,
            invalidAfterAmount,
            BalanceChangeCode.SYSTEM_CHARGE,
            null,
            null,
          ),
      ).toThrow();

      try {
        new UserBalanceChangeLog(
          1,
          100,
          amount,
          beforeAmount,
          invalidAfterAmount,
          BalanceChangeCode.SYSTEM_CHARGE,
          null,
          null,
        );
      } catch (error) {
        expect(error.name).toBe('ValidationException');
        expect((error as ValidationException).errorCode).toBe(
          ErrorCode.USER_LOG_INVALID_CALCULATION,
        );
      }
    });
  });

  describe('BalanceChangeCode', () => {
    it('SYSTEM_CHARGE 코드를 사용할 수 있다', () => {
      // given
      const code = BalanceChangeCode.SYSTEM_CHARGE;

      // when
      const log = new UserBalanceChangeLog(
        1,
        100,
        5000,
        10000,
        15000,
        code,
        null,
        null,
      );

      // then
      expect(log.code).toBe(BalanceChangeCode.SYSTEM_CHARGE);
    });

    it('PAYMENT 코드를 사용할 수 있다', () => {
      // given
      const code = BalanceChangeCode.PAYMENT;

      // when
      const log = new UserBalanceChangeLog(
        1,
        100,
        -3000,
        10000,
        7000,
        code,
        null,
        null,
      );

      // then
      expect(log.code).toBe(BalanceChangeCode.PAYMENT);
    });

    it('ADJUST 코드를 사용할 수 있다', () => {
      // given
      const code = BalanceChangeCode.ADJUST;

      // when
      const log = new UserBalanceChangeLog(
        1,
        100,
        1000,
        10000,
        11000,
        code,
        null,
        null,
      );

      // then
      expect(log.code).toBe(BalanceChangeCode.ADJUST);
    });
  });
});
