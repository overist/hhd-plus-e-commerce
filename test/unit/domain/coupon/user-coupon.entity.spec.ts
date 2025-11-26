import { UserCoupon } from '@/coupon/domain/entities/user-coupon.entity';
import { Coupon } from '@/coupon/domain/entities/coupon.entity';
import { ErrorCode, DomainException } from '@common/exception';

describe('UserCoupon Entity', () => {
  describe('생성자', () => {
    it('유효한 값으로 UserCoupon을 생성한다', () => {
      // given
      const id = 1;
      const userId = 100;
      const couponId = 200;
      const orderId = null;
      const createdAt = new Date();
      const usedAt = null;
      const expiredAt = new Date('2025-12-31');
      const updatedAt = new Date();

      // when
      const userCoupon = new UserCoupon(
        id,
        userId,
        couponId,
        orderId,
        createdAt,
        usedAt,
        expiredAt,
        updatedAt,
      );

      // then
      expect(userCoupon.id).toBe(id);
      expect(userCoupon.userId).toBe(userId);
      expect(userCoupon.couponId).toBe(couponId);
      expect(userCoupon.orderId).toBe(orderId);
      expect(userCoupon.createdAt).toBe(createdAt);
      expect(userCoupon.usedAt).toBe(usedAt);
      expect(userCoupon.expiredAt).toBe(expiredAt);
      expect(userCoupon.updatedAt).toBe(updatedAt);
    });
  });

  describe('issue (정적 팩토리 메서드)', () => {
    it('유효한 쿠폰으로 UserCoupon을 발급한다', () => {
      // given
      const userId = 100;
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

      // when
      const userCoupon = UserCoupon.issue(userId, coupon);

      // then
      expect(userCoupon.userId).toBe(userId);
      expect(userCoupon.couponId).toBe(coupon.id);
      expect(userCoupon.orderId).toBeNull();
      expect(userCoupon.usedAt).toBeNull();
      expect(userCoupon.expiredAt).toBe(coupon.expiredAt);
    });
  });

  describe('canUse', () => {
    it('사용 가능한 쿠폰은 true를 반환한다', () => {
      // given
      const userCoupon = new UserCoupon(
        1,
        100,
        200,
        null,
        new Date(),
        null,
        new Date('2025-12-31'),
        new Date(),
      );

      // when
      const result = userCoupon.canUse();

      // then
      expect(result).toBe(true);
    });

    it('이미 사용된 쿠폰은 false를 반환한다', () => {
      // given
      const userCoupon = new UserCoupon(
        1,
        100,
        200,
        1000,
        new Date(),
        new Date(),
        new Date('2025-12-31'),
        new Date(),
      );

      // when
      const result = userCoupon.canUse();

      // then
      expect(result).toBe(false);
    });

    it('만료된 쿠폰은 false를 반환한다', () => {
      // given
      const userCoupon = new UserCoupon(
        1,
        100,
        200,
        null,
        new Date(),
        null,
        new Date('2020-01-01'),
        new Date(),
      );

      // when
      const result = userCoupon.canUse();

      // then
      expect(result).toBe(false);
    });
  });

  describe('isUsed', () => {
    it('사용되지 않은 쿠폰은 false를 반환한다', () => {
      // given
      const userCoupon = new UserCoupon(
        1,
        100,
        200,
        null,
        new Date(),
        null,
        new Date('2025-12-31'),
        new Date(),
      );

      // when
      const result = userCoupon.isUsed();

      // then
      expect(result).toBe(false);
    });

    it('사용된 쿠폰은 true를 반환한다', () => {
      // given
      const userCoupon = new UserCoupon(
        1,
        100,
        200,
        1000,
        new Date(),
        new Date(),
        new Date('2025-12-31'),
        new Date(),
      );

      // when
      const result = userCoupon.isUsed();

      // then
      expect(result).toBe(true);
    });
  });

  describe('isExpired', () => {
    it('만료되지 않은 쿠폰은 false를 반환한다', () => {
      // given
      const userCoupon = new UserCoupon(
        1,
        100,
        200,
        null,
        new Date(),
        null,
        new Date('2025-12-31'),
        new Date(),
      );

      // when
      const result = userCoupon.isExpired();

      // then
      expect(result).toBe(false);
    });

    it('만료된 쿠폰은 true를 반환한다', () => {
      // given
      const userCoupon = new UserCoupon(
        1,
        100,
        200,
        null,
        new Date(),
        null,
        new Date('2020-01-01'),
        new Date(),
      );

      // when
      const result = userCoupon.isExpired();

      // then
      expect(result).toBe(true);
    });
  });

  describe('use', () => {
    it('사용 가능한 쿠폰을 사용하고 orderId와 usedAt을 설정한다', () => {
      // given
      const userCoupon = new UserCoupon(
        1,
        100,
        200,
        null,
        new Date(),
        null,
        new Date('2025-12-31'),
        new Date(),
      );
      const orderId = 1000;

      // when
      userCoupon.use(orderId);

      // then
      expect(userCoupon.orderId).toBe(orderId);
      expect(userCoupon.usedAt).not.toBeNull();
      expect(userCoupon.updatedAt).toBeDefined();
    });

    it('이미 사용된 쿠폰을 사용하려 하면 ALREADY_USED 예외를 던진다', () => {
      // given
      const userCoupon = new UserCoupon(
        1,
        100,
        200,
        1000,
        new Date(),
        new Date(),
        new Date('2025-12-31'),
        new Date(),
      );
      const newOrderId = 2000;

      // when & then
      expect(() => userCoupon.use(newOrderId)).toThrow(DomainException);

      try {
        userCoupon.use(newOrderId);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.ALREADY_USED,
        );
      }
    });

    it('만료된 쿠폰을 사용하려 하면 EXPIRED_COUPON 예외를 던진다', () => {
      // given
      const userCoupon = new UserCoupon(
        1,
        100,
        200,
        null,
        new Date(),
        null,
        new Date('2020-01-01'),
        new Date(),
      );
      const orderId = 1000;

      // when & then
      expect(() => userCoupon.use(orderId)).toThrow(DomainException);

      try {
        userCoupon.use(orderId);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.EXPIRED_COUPON,
        );
      }
    });
  });

  describe('getStatus', () => {
    it('사용 가능한 쿠폰은 AVAILABLE 상태를 반환한다', () => {
      // given
      const userCoupon = new UserCoupon(
        1,
        100,
        200,
        null,
        new Date(),
        null,
        new Date('2025-12-31'),
        new Date(),
      );

      // when
      const status = userCoupon.getStatus();

      // then
      expect(status).toBe('AVAILABLE');
    });

    it('사용된 쿠폰은 USED 상태를 반환한다', () => {
      // given
      const userCoupon = new UserCoupon(
        1,
        100,
        200,
        1000,
        new Date(),
        new Date(),
        new Date('2025-12-31'),
        new Date(),
      );

      // when
      const status = userCoupon.getStatus();

      // then
      expect(status).toBe('USED');
    });

    it('만료된 쿠폰은 EXPIRED 상태를 반환한다', () => {
      // given
      const userCoupon = new UserCoupon(
        1,
        100,
        200,
        null,
        new Date(),
        null,
        new Date('2020-01-01'),
        new Date(),
      );

      // when
      const status = userCoupon.getStatus();

      // then
      expect(status).toBe('EXPIRED');
    });
  });
});
