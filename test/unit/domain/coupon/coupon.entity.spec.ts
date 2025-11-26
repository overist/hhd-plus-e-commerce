import { Coupon } from '@/coupon/domain/entities/coupon.entity';
import { ErrorCode, DomainException } from '@common/exception';

describe('Coupon Entity', () => {
  describe('생성자', () => {
    it('유효한 값으로 Coupon을 생성한다', () => {
      // given
      const id = 1;
      const name = '10% 할인 쿠폰';
      const discountRate = 10;
      const totalQuantity = 100;
      const issuedQuantity = 0;
      const expiredAt = new Date('2025-12-31');
      const createdAt = new Date();
      const updatedAt = new Date();

      // when
      const coupon = new Coupon(
        id,
        name,
        discountRate,
        totalQuantity,
        issuedQuantity,
        expiredAt,
        createdAt,
        updatedAt,
      );

      // then
      expect(coupon.id).toBe(id);
      expect(coupon.name).toBe(name);
      expect(coupon.discountRate).toBe(discountRate);
      expect(coupon.totalQuantity).toBe(totalQuantity);
      expect(coupon.issuedQuantity).toBe(issuedQuantity);
      expect(coupon.expiredAt).toBe(expiredAt);
      expect(coupon.createdAt).toBe(createdAt);
      expect(coupon.updatedAt).toBe(updatedAt);
    });

    it('할인율이 0이면 INVALID_DISCOUNT_RATE 예외를 던진다', () => {
      // given
      const invalidDiscountRate = 0;

      // when & then
      expect(
        () =>
          new Coupon(
            1,
            '무효 쿠폰',
            invalidDiscountRate,
            100,
            0,
            new Date('2025-12-31'),
            new Date(),
            new Date(),
          ),
      ).toThrow();

      try {
        new Coupon(
          1,
          '무효 쿠폰',
          invalidDiscountRate,
          100,
          0,
          new Date('2025-12-31'),
          new Date(),
          new Date(),
        );
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_DISCOUNT_RATE,
        );
      }
    });

    it('할인율이 100을 초과하면 INVALID_DISCOUNT_RATE 예외를 던진다', () => {
      // given
      const invalidDiscountRate = 101;

      // when & then
      expect(
        () =>
          new Coupon(
            1,
            '무효 쿠폰',
            invalidDiscountRate,
            100,
            0,
            new Date('2025-12-31'),
            new Date(),
            new Date(),
          ),
      ).toThrow();

      try {
        new Coupon(
          1,
          '무효 쿠폰',
          invalidDiscountRate,
          100,
          0,
          new Date('2025-12-31'),
          new Date(),
          new Date(),
        );
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_DISCOUNT_RATE,
        );
      }
    });

    it('총 수량이 음수이면 INVALID_ISSUE_QUANTITY 예외를 던진다', () => {
      // given
      const invalidTotalQuantity = -1;

      // when & then
      expect(
        () =>
          new Coupon(
            1,
            '무효 쿠폰',
            10,
            invalidTotalQuantity,
            0,
            new Date('2025-12-31'),
            new Date(),
            new Date(),
          ),
      ).toThrow();

      try {
        new Coupon(
          1,
          '무효 쿠폰',
          10,
          invalidTotalQuantity,
          0,
          new Date('2025-12-31'),
          new Date(),
          new Date(),
        );
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_ISSUE_QUANTITY,
        );
      }
    });

    it('발급된 수량이 음수이면 INVALID_ISSUE_QUANTITY 예외를 던진다', () => {
      // given
      const invalidIssuedQuantity = -1;

      // when & then
      expect(
        () =>
          new Coupon(
            1,
            '무효 쿠폰',
            10,
            100,
            invalidIssuedQuantity,
            new Date('2025-12-31'),
            new Date(),
            new Date(),
          ),
      ).toThrow();

      try {
        new Coupon(
          1,
          '무효 쿠폰',
          10,
          100,
          invalidIssuedQuantity,
          new Date('2025-12-31'),
          new Date(),
          new Date(),
        );
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_ISSUE_QUANTITY,
        );
      }
    });

    it('발급된 수량이 총 수량을 초과하면 INVALID_ISSUE_QUANTITY 예외를 던진다', () => {
      // given
      const totalQuantity = 100;
      const invalidIssuedQuantity = 101;

      // when & then
      expect(
        () =>
          new Coupon(
            1,
            '무효 쿠폰',
            10,
            totalQuantity,
            invalidIssuedQuantity,
            new Date('2025-12-31'),
            new Date(),
            new Date(),
          ),
      ).toThrow();

      try {
        new Coupon(
          1,
          '무효 쿠폰',
          10,
          totalQuantity,
          invalidIssuedQuantity,
          new Date('2025-12-31'),
          new Date(),
          new Date(),
        );
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_ISSUE_QUANTITY,
        );
      }
    });
  });

  describe('validateIssuable', () => {
    it('발급 가능한 쿠폰은 예외를 던지지 않는다', () => {
      // given
      const coupon = new Coupon(
        1,
        '10% 할인',
        10,
        100,
        50,
        new Date('2025-12-31'),
        new Date(),
        new Date(),
      );

      // when & then
      expect(() => coupon.validateIssuable()).not.toThrow();
    });

    it('만료된 쿠폰은 EXPIRED_COUPON 예외를 던진다', () => {
      // given
      const expiredDate = new Date('2020-01-01');
      const coupon = new Coupon(
        1,
        '만료 쿠폰',
        10,
        100,
        50,
        expiredDate,
        new Date(),
        new Date(),
      );

      // when & then
      expect(() => coupon.validateIssuable()).toThrow(DomainException);

      try {
        coupon.validateIssuable();
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.EXPIRED_COUPON,
        );
      }
    });

    it('발급 수량이 다 찬 쿠폰은 COUPON_SOLD_OUT 예외를 던진다', () => {
      // given
      const coupon = new Coupon(
        1,
        '품절 쿠폰',
        10,
        100,
        100,
        new Date('2025-12-31'),
        new Date(),
        new Date(),
      );

      // when & then
      expect(() => coupon.validateIssuable()).toThrow(DomainException);

      try {
        coupon.validateIssuable();
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.COUPON_SOLD_OUT,
        );
      }
    });
  });

  describe('isExpired', () => {
    it('만료되지 않은 쿠폰은 false를 반환한다', () => {
      // given
      const futureDate = new Date('2025-12-31');
      const coupon = new Coupon(
        1,
        '유효 쿠폰',
        10,
        100,
        0,
        futureDate,
        new Date(),
        new Date(),
      );

      // when
      const result = coupon.isExpired();

      // then
      expect(result).toBe(false);
    });

    it('만료된 쿠폰은 true를 반환한다', () => {
      // given
      const pastDate = new Date('2020-01-01');
      const coupon = new Coupon(
        1,
        '만료 쿠폰',
        10,
        100,
        0,
        pastDate,
        new Date(),
        new Date(),
      );

      // when
      const result = coupon.isExpired();

      // then
      expect(result).toBe(true);
    });
  });

  describe('issue', () => {
    it('발급 가능한 쿠폰을 발급하고 발급 수량을 증가시킨다', () => {
      // given
      const coupon = new Coupon(
        1,
        '10% 할인',
        10,
        100,
        50,
        new Date('2025-12-31'),
        new Date(),
        new Date(),
      );
      const originalIssuedQuantity = coupon.issuedQuantity;

      // when
      coupon.issue();

      // then
      expect(coupon.issuedQuantity).toBe(originalIssuedQuantity + 1);
    });

    it('만료된 쿠폰을 발급하려 하면 EXPIRED_COUPON 예외를 던진다', () => {
      // given
      const expiredDate = new Date('2020-01-01');
      const coupon = new Coupon(
        1,
        '만료 쿠폰',
        10,
        100,
        50,
        expiredDate,
        new Date(),
        new Date(),
      );

      // when & then
      expect(() => coupon.issue()).toThrow(DomainException);

      try {
        coupon.issue();
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.EXPIRED_COUPON,
        );
      }
    });

    it('품절된 쿠폰을 발급하려 하면 COUPON_SOLD_OUT 예외를 던진다', () => {
      // given
      const coupon = new Coupon(
        1,
        '품절 쿠폰',
        10,
        100,
        100,
        new Date('2025-12-31'),
        new Date(),
        new Date(),
      );

      // when & then
      expect(() => coupon.issue()).toThrow(DomainException);

      try {
        coupon.issue();
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.COUPON_SOLD_OUT,
        );
      }
    });
  });

  describe('calculateDiscount', () => {
    it('할인 금액을 올바르게 계산한다', () => {
      // given
      const coupon = new Coupon(
        1,
        '10% 할인',
        10,
        100,
        0,
        new Date('2025-12-31'),
        new Date(),
        new Date(),
      );
      const amount = 10000;

      // when
      const discount = coupon.calculateDiscount(amount);

      // then
      expect(discount).toBe(1000); // 10000 * 0.1 = 1000
    });

    it('할인 금액은 소숫점 첫 번째 자리에서 버린다', () => {
      // given
      const coupon = new Coupon(
        1,
        '15% 할인',
        15,
        100,
        0,
        new Date('2025-12-31'),
        new Date(),
        new Date(),
      );
      const amount = 1234;

      // when
      const discount = coupon.calculateDiscount(amount);

      // then
      expect(discount).toBe(185); // 1234 * 0.15 = 185.1 -> 185
    });

    it('금액이 음수이면 INVALID_DISCOUNT_RATE 예외를 던진다', () => {
      // given
      const coupon = new Coupon(
        1,
        '10% 할인',
        10,
        100,
        0,
        new Date('2025-12-31'),
        new Date(),
        new Date(),
      );
      const invalidAmount = -1000;

      // when & then
      expect(() => coupon.calculateDiscount(invalidAmount)).toThrow();

      try {
        coupon.calculateDiscount(invalidAmount);
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_DISCOUNT_RATE,
        );
      }
    });
  });

  describe('getRemain', () => {
    it('남은 발급 가능 수량을 반환한다', () => {
      // given
      const coupon = new Coupon(
        1,
        '10% 할인',
        10,
        100,
        30,
        new Date('2025-12-31'),
        new Date(),
        new Date(),
      );

      // when
      const remain = coupon.getRemain();

      // then
      expect(remain).toBe(70); // 100 - 30
    });

    it('발급 수량이 다 찬 경우 0을 반환한다', () => {
      // given
      const coupon = new Coupon(
        1,
        '품절 쿠폰',
        10,
        100,
        100,
        new Date('2025-12-31'),
        new Date(),
        new Date(),
      );

      // when
      const remain = coupon.getRemain();

      // then
      expect(remain).toBe(0);
    });
  });
});
