import { Order } from '@/order/domain/entities/order.entity';
import { OrderStatus } from '@/order/domain/entities/order-status.vo';
import { ErrorCode, DomainException } from '@common/exception';

describe('Order Entity', () => {
  describe('생성자', () => {
    it('유효한 값으로 Order를 생성한다', () => {
      // given
      const id = 1;
      const userId = 100;
      const couponId = null;
      const totalAmount = 30000;
      const discountAmount = 0;
      const finalAmount = 30000;
      const status = OrderStatus.PENDING;
      const createdAt = new Date();
      const paidAt = null;
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const updatedAt = new Date();

      // when
      const order = new Order(
        id,
        userId,
        couponId,
        totalAmount,
        discountAmount,
        finalAmount,
        status,
        createdAt,
        paidAt,
        expiredAt,
        updatedAt,
      );

      // then
      expect(order.id).toBe(id);
      expect(order.userId).toBe(userId);
      expect(order.couponId).toBeNull();
      expect(order.totalAmount).toBe(totalAmount);
      expect(order.discountAmount).toBe(discountAmount);
      expect(order.finalAmount).toBe(finalAmount);
      expect(order.status).toBe(status);
      expect(order.createdAt).toBe(createdAt);
      expect(order.paidAt).toBeNull();
      expect(order.expiredAt).toBe(expiredAt);
      expect(order.updatedAt).toBe(updatedAt);
    });

    it('totalAmount가 음수이면 INVALID_AMOUNT 예외를 던진다', () => {
      // given
      const invalidTotalAmount = -1000;
      const createdAt = new Date();
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);

      // when & then
      expect(
        () =>
          new Order(
            1,
            100,
            null,
            invalidTotalAmount,
            0,
            invalidTotalAmount,
            OrderStatus.PENDING,
            createdAt,
            null,
            expiredAt,
            new Date(),
          ),
      ).toThrow();

      try {
        new Order(
          1,
          100,
          null,
          invalidTotalAmount,
          0,
          invalidTotalAmount,
          OrderStatus.PENDING,
          createdAt,
          null,
          expiredAt,
          new Date(),
        );
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_AMOUNT,
        );
      }
    });

    it('discountAmount가 음수이면 INVALID_AMOUNT 예외를 던진다', () => {
      // given
      const invalidDiscountAmount = -1000;
      const createdAt = new Date();
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);

      // when & then
      expect(
        () =>
          new Order(
            1,
            100,
            null,
            30000,
            invalidDiscountAmount,
            30000,
            OrderStatus.PENDING,
            createdAt,
            null,
            expiredAt,
            new Date(),
          ),
      ).toThrow();
    });

    it('finalAmount가 totalAmount - discountAmount와 일치하지 않으면 INVALID_AMOUNT 예외를 던진다', () => {
      // given
      const totalAmount = 30000;
      const discountAmount = 5000;
      const invalidFinalAmount = 20000; // 올바른 값은 25000
      const createdAt = new Date();
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);

      // when & then
      expect(
        () =>
          new Order(
            1,
            100,
            null,
            totalAmount,
            discountAmount,
            invalidFinalAmount,
            OrderStatus.PENDING,
            createdAt,
            null,
            expiredAt,
            new Date(),
          ),
      ).toThrow();
    });

    it('expiredAt이 createdAt보다 이전이면 INVALID_ARGUMENT 예외를 던진다', () => {
      // given
      const createdAt = new Date();
      const invalidExpiredAt = new Date(createdAt.getTime() - 1000);

      // when & then
      expect(
        () =>
          new Order(
            1,
            100,
            null,
            30000,
            0,
            30000,
            OrderStatus.PENDING,
            createdAt,
            null,
            invalidExpiredAt,
            new Date(),
          ),
      ).toThrow();

      try {
        new Order(
          1,
          100,
          null,
          30000,
          0,
          30000,
          OrderStatus.PENDING,
          createdAt,
          null,
          invalidExpiredAt,
          new Date(),
        );
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_ARGUMENT,
        );
      }
    });
  });

  describe('isExpired', () => {
    it('만료 시간이 지나지 않았으면 false를 반환한다', () => {
      // given
      const createdAt = new Date();
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        100,
        null,
        30000,
        0,
        30000,
        OrderStatus.PENDING,
        createdAt,
        null,
        expiredAt,
        new Date(),
      );

      // when
      const result = order.isExpired();

      // then
      expect(result).toBe(false);
    });

    it('만료 시간이 지났으면 true를 반환한다', () => {
      // given
      const createdAt = new Date(Date.now() - 20 * 60 * 1000);
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        100,
        null,
        30000,
        0,
        30000,
        OrderStatus.PENDING,
        createdAt,
        null,
        expiredAt,
        new Date(),
      );

      // when
      const result = order.isExpired();

      // then
      expect(result).toBe(true);
    });
  });

  describe('canPay', () => {
    it('PENDING 상태이고 만료되지 않았으면 true를 반환한다', () => {
      // given
      const createdAt = new Date();
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        100,
        null,
        30000,
        0,
        30000,
        OrderStatus.PENDING,
        createdAt,
        null,
        expiredAt,
        new Date(),
      );

      // when
      const result = order.canPay();

      // then
      expect(result).toBe(true);
    });

    it('PAID 상태이면 false를 반환한다', () => {
      // given
      const createdAt = new Date();
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        100,
        null,
        30000,
        0,
        30000,
        OrderStatus.PAID,
        createdAt,
        new Date(),
        expiredAt,
        new Date(),
      );

      // when
      const result = order.canPay();

      // then
      expect(result).toBe(false);
    });

    it('만료되었으면 false를 반환한다', () => {
      // given
      const createdAt = new Date(Date.now() - 20 * 60 * 1000);
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        100,
        null,
        30000,
        0,
        30000,
        OrderStatus.PENDING,
        createdAt,
        null,
        expiredAt,
        new Date(),
      );

      // when
      const result = order.canPay();

      // then
      expect(result).toBe(false);
    });
  });

  describe('beginPaymentProcessing / completePayment', () => {
    it('결제 가능한 주문을 결제 처리로 전환하고 최종적으로 PAID로 변경한다', () => {
      // given
      const createdAt = new Date();
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        100,
        null,
        30000,
        0,
        30000,
        OrderStatus.PENDING,
        createdAt,
        null,
        expiredAt,
        new Date(),
      );

      // when
      order.beginPaymentProcessing();
      order.completePayment();

      // then
      expect(order.status).toBe(OrderStatus.PAID);
      expect(order.paidAt).not.toBeNull();
      expect(order.updatedAt).toBeDefined();
    });

    it('이미 결제된 주문을 결제 처리로 전환하려 하면 ALREADY_PAID 예외를 던진다', () => {
      // given
      const createdAt = new Date();
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        100,
        null,
        30000,
        0,
        30000,
        OrderStatus.PAID,
        createdAt,
        new Date(),
        expiredAt,
        new Date(),
      );

      // when & then
      expect(() => order.beginPaymentProcessing()).toThrow(DomainException);

      try {
        order.beginPaymentProcessing();
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.ALREADY_PAID,
        );
      }
    });

    it('만료된 주문을 결제 처리로 전환하려 하면 ORDER_EXPIRED 예외를 던진다', () => {
      // given
      const createdAt = new Date(Date.now() - 20 * 60 * 1000);
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        100,
        null,
        30000,
        0,
        30000,
        OrderStatus.PENDING,
        createdAt,
        null,
        expiredAt,
        new Date(),
      );

      // when & then
      expect(() => order.beginPaymentProcessing()).toThrow(DomainException);

      try {
        order.beginPaymentProcessing();
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.ORDER_EXPIRED,
        );
      }
    });
  });

  describe('applyCoupon', () => {
    it('쿠폰을 적용하고 할인 금액을 차감한다', () => {
      // given
      const createdAt = new Date();
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        100,
        null,
        30000,
        0,
        30000,
        OrderStatus.PENDING,
        createdAt,
        null,
        expiredAt,
        new Date(),
      );
      const couponId = 5;
      const discountRate = 10;

      // when
      order.applyCoupon(couponId, discountRate);

      // then
      expect(order.couponId).toBe(couponId);
      expect(order.discountAmount).toBe(3000); // 30000 * 10%
      expect(order.finalAmount).toBe(27000); // 30000 - 3000
    });

    it('할인 금액이 음수이면 INVALID_AMOUNT 예외를 던진다', () => {
      // given
      const createdAt = new Date();
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        100,
        null,
        30000,
        0,
        30000,
        OrderStatus.PENDING,
        createdAt,
        null,
        expiredAt,
        new Date(),
      );
      const invalidDiscountAmount = -1000;

      // when & then
      expect(() => order.applyCoupon(5, invalidDiscountAmount)).toThrow();

      try {
        order.applyCoupon(5, invalidDiscountAmount);
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_AMOUNT,
        );
      }
    });

    it('할인 금액이 총액보다 크면 INVALID_AMOUNT 예외를 던진다', () => {
      // given
      const createdAt = new Date();
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        100,
        null,
        30000,
        0,
        30000,
        OrderStatus.PENDING,
        createdAt,
        null,
        expiredAt,
        new Date(),
      );
      const excessiveDiscountAmount = 35000;

      // when & then
      expect(() => order.applyCoupon(5, excessiveDiscountAmount)).toThrow();
    });
  });

  describe('expire', () => {
    it('만료된 PENDING 상태의 주문을 EXPIRED 상태로 변경한다', () => {
      // given
      const createdAt = new Date(Date.now() - 20 * 60 * 1000);
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        100,
        null,
        30000,
        0,
        30000,
        OrderStatus.PENDING,
        createdAt,
        null,
        expiredAt,
        new Date(),
      );

      // when
      order.expire();

      // then
      expect(order.status).toBe(OrderStatus.EXPIRED);
    });

    it('PENDING 상태가 아니면 INVALID_ORDER_STATUS 예외를 던진다', () => {
      // given
      const createdAt = new Date();
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        100,
        null,
        30000,
        0,
        30000,
        OrderStatus.PAID,
        createdAt,
        new Date(),
        expiredAt,
        new Date(),
      );

      // when & then
      expect(() => order.expire()).toThrow(DomainException);

      try {
        order.expire();
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_ORDER_STATUS,
        );
      }
    });

    it('아직 만료되지 않았으면 INVALID_ORDER_STATUS 예외를 던진다', () => {
      // given
      const createdAt = new Date();
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        100,
        null,
        30000,
        0,
        30000,
        OrderStatus.PENDING,
        createdAt,
        null,
        expiredAt,
        new Date(),
      );

      // when & then
      expect(() => order.expire()).toThrow(DomainException);
    });
  });

  describe('isOwnedBy', () => {
    it('주문 소유자가 맞으면 true를 반환한다', () => {
      // given
      const userId = 100;
      const createdAt = new Date();
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        userId,
        null,
        30000,
        0,
        30000,
        OrderStatus.PENDING,
        createdAt,
        null,
        expiredAt,
        new Date(),
      );

      // when
      const result = order.isOwnedBy(userId);

      // then
      expect(result).toBe(true);
    });

    it('주문 소유자가 아니면 false를 반환한다', () => {
      // given
      const userId = 100;
      const otherUserId = 999;
      const createdAt = new Date();
      const expiredAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
      const order = new Order(
        1,
        userId,
        null,
        30000,
        0,
        30000,
        OrderStatus.PENDING,
        createdAt,
        null,
        expiredAt,
        new Date(),
      );

      // when
      const result = order.isOwnedBy(otherUserId);

      // then
      expect(result).toBe(false);
    });
  });
});
