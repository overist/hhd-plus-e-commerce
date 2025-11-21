import { OrderItem } from '@domain/order/order-item.entity';
import { ErrorCode } from '@domain/common/constants/error-code';
import { ValidationException } from '@domain/common/exceptions/domain.exception';

describe('OrderItem Entity', () => {
  describe('생성자', () => {
    it('유효한 값으로 OrderItem을 생성한다', () => {
      // given
      const id = 1;
      const orderId = 100;
      const productOptionId = 200;
      const productName = '테스트 상품';
      const price = 10000;
      const quantity = 3;
      const subtotal = 30000;
      const createdAt = new Date();

      // when
      const orderItem = new OrderItem(
        id,
        orderId,
        productOptionId,
        productName,
        price,
        quantity,
        subtotal,
        createdAt,
      );

      // then
      expect(orderItem.id).toBe(id);
      expect(orderItem.orderId).toBe(orderId);
      expect(orderItem.productOptionId).toBe(productOptionId);
      expect(orderItem.productName).toBe(productName);
      expect(orderItem.price).toBe(price);
      expect(orderItem.quantity).toBe(quantity);
      expect(orderItem.subtotal).toBe(subtotal);
      expect(orderItem.createdAt).toBe(createdAt);
    });

    it('가격이 음수이면 INVALID_PRICE 예외를 던진다', () => {
      // given
      const invalidPrice = -1000;

      // when & then
      expect(
        () =>
          new OrderItem(
            1,
            100,
            200,
            '테스트 상품',
            invalidPrice,
            3,
            -3000,
            new Date(),
          ),
      ).toThrow();

      try {
        new OrderItem(
          1,
          100,
          200,
          '테스트 상품',
          invalidPrice,
          3,
          -3000,
          new Date(),
        );
      } catch (error) {
        expect(error.name).toBe('ValidationException');
        expect((error as ValidationException).errorCode).toBe(
          ErrorCode.INVALID_PRICE,
        );
      }
    });

    it('가격이 0이면 정상적으로 생성된다', () => {
      // given
      const zeroPrice = 0;

      // when
      const orderItem = new OrderItem(
        1,
        100,
        200,
        '무료 상품',
        zeroPrice,
        3,
        0,
        new Date(),
      );

      // then
      expect(orderItem.price).toBe(0);
      expect(orderItem.subtotal).toBe(0);
    });

    it('수량이 0이면 INVALID_QUANTITY 예외를 던진다', () => {
      // given
      const invalidQuantity = 0;

      // when & then
      expect(
        () =>
          new OrderItem(
            1,
            100,
            200,
            '테스트 상품',
            10000,
            invalidQuantity,
            0,
            new Date(),
          ),
      ).toThrow();

      try {
        new OrderItem(
          1,
          100,
          200,
          '테스트 상품',
          10000,
          invalidQuantity,
          0,
          new Date(),
        );
      } catch (error) {
        expect(error.name).toBe('ValidationException');
        expect((error as ValidationException).errorCode).toBe(
          ErrorCode.INVALID_QUANTITY,
        );
      }
    });

    it('수량이 음수이면 INVALID_QUANTITY 예외를 던진다', () => {
      // given
      const invalidQuantity = -3;

      // when & then
      expect(
        () =>
          new OrderItem(
            1,
            100,
            200,
            '테스트 상품',
            10000,
            invalidQuantity,
            -30000,
            new Date(),
          ),
      ).toThrow();
    });

    it('수량이 정수가 아니면 INVALID_QUANTITY 예외를 던진다', () => {
      // given
      const invalidQuantity = 3.5;

      // when & then
      expect(
        () =>
          new OrderItem(
            1,
            100,
            200,
            '테스트 상품',
            10000,
            invalidQuantity,
            35000,
            new Date(),
          ),
      ).toThrow();
    });

    it('subtotal이 음수이면 INVALID_AMOUNT 예외를 던진다', () => {
      // given
      const invalidSubtotal = -30000;

      // when & then
      expect(
        () =>
          new OrderItem(
            1,
            100,
            200,
            '테스트 상품',
            10000,
            3,
            invalidSubtotal,
            new Date(),
          ),
      ).toThrow();

      try {
        new OrderItem(
          1,
          100,
          200,
          '테스트 상품',
          10000,
          3,
          invalidSubtotal,
          new Date(),
        );
      } catch (error) {
        expect(error.name).toBe('ValidationException');
        expect((error as ValidationException).errorCode).toBe(
          ErrorCode.INVALID_AMOUNT,
        );
      }
    });

    it('subtotal이 price * quantity와 일치하지 않으면 INVALID_AMOUNT 예외를 던진다', () => {
      // given
      const price = 10000;
      const quantity = 3;
      const invalidSubtotal = 25000; // 올바른 값은 30000

      // when & then
      expect(
        () =>
          new OrderItem(
            1,
            100,
            200,
            '테스트 상품',
            price,
            quantity,
            invalidSubtotal,
            new Date(),
          ),
      ).toThrow();
    });
  });
});
