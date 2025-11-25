import { CartItem } from '@/cart/domain/entities/cart-item.entity';
import {
  ErrorCode,
  DomainException,
  ValidationException,
} from '@common/exception';

describe('CartItem Entity', () => {
  describe('생성자', () => {
    it('유효한 값으로 CartItem을 생성한다', () => {
      // given
      const id = 1;
      const userId = 100;
      const productOptionId = 200;
      const quantity = 5;
      const createdAt = new Date();
      const updatedAt = new Date();

      // when
      const cartItem = new CartItem(
        id,
        userId,
        productOptionId,
        quantity,
        createdAt,
        updatedAt,
      );

      // then
      expect(cartItem.id).toBe(id);
      expect(cartItem.userId).toBe(userId);
      expect(cartItem.productOptionId).toBe(productOptionId);
      expect(cartItem.quantity).toBe(quantity);
      expect(cartItem.createdAt).toBe(createdAt);
      expect(cartItem.updatedAt).toBe(updatedAt);
    });

    it('수량이 0이면 INVALID_QUANTITY 예외를 던진다', () => {
      // given
      const invalidQuantity = 0;

      // when & then
      expect(
        () =>
          new CartItem(1, 100, 200, invalidQuantity, new Date(), new Date()),
      ).toThrow();

      try {
        new CartItem(1, 100, 200, invalidQuantity, new Date(), new Date());
      } catch (error) {
        expect(error.name).toBe('ValidationException');
        expect((error as ValidationException).errorCode).toBe(
          ErrorCode.INVALID_QUANTITY,
        );
      }
    });

    it('수량이 음수이면 INVALID_QUANTITY 예외를 던진다', () => {
      // given
      const invalidQuantity = -1;

      // when & then
      expect(
        () =>
          new CartItem(1, 100, 200, invalidQuantity, new Date(), new Date()),
      ).toThrow();

      try {
        new CartItem(1, 100, 200, invalidQuantity, new Date(), new Date());
      } catch (error) {
        expect(error.name).toBe('ValidationException');
        expect((error as ValidationException).errorCode).toBe(
          ErrorCode.INVALID_QUANTITY,
        );
      }
    });

    it('수량이 정수가 아니면 INVALID_QUANTITY 예외를 던진다', () => {
      // given
      const invalidQuantity = 1.5;

      // when & then
      expect(
        () =>
          new CartItem(1, 100, 200, invalidQuantity, new Date(), new Date()),
      ).toThrow();

      try {
        new CartItem(1, 100, 200, invalidQuantity, new Date(), new Date());
      } catch (error) {
        expect(error.name).toBe('ValidationException');
        expect((error as ValidationException).errorCode).toBe(
          ErrorCode.INVALID_QUANTITY,
        );
      }
    });
  });

  describe('validateOwnership', () => {
    it('userId가 일치하면 검증을 통과한다', () => {
      // given
      const userId = 100;
      const cartItem = new CartItem(1, userId, 200, 5, new Date(), new Date());

      // when & then
      expect(() => cartItem.validateOwnership(userId)).not.toThrow();
    });

    it('userId가 일치하지 않으면 UNAUTHORIZED 예외를 던진다', () => {
      // given
      const userId = 100;
      const differentUserId = 999;
      const cartItem = new CartItem(1, userId, 200, 5, new Date(), new Date());

      // when & then
      expect(() => cartItem.validateOwnership(differentUserId)).toThrow(
        DomainException,
      );

      try {
        cartItem.validateOwnership(differentUserId);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.UNAUTHORIZED,
        );
      }
    });
  });

  describe('increaseQuantity', () => {
    it('유효한 수량을 증가시키고 updatedAt을 갱신한다', () => {
      // given
      const cartItem = new CartItem(1, 100, 200, 5, new Date(), new Date());
      const originalUpdatedAt = cartItem.updatedAt;

      // when
      cartItem.increaseQuantity(3);

      // then
      expect(cartItem.quantity).toBe(8);
      expect(cartItem.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });

    it('0 이하의 수량이면 INVALID_QUANTITY 예외를 던진다', () => {
      // given
      const cartItem = new CartItem(1, 100, 200, 5, new Date(), new Date());

      // when & then
      expect(() => cartItem.increaseQuantity(0)).toThrow(ValidationException);
      expect(() => cartItem.increaseQuantity(-1)).toThrow(ValidationException);
    });
  });

  describe('decreaseQuantity', () => {
    it('유효한 수량을 감소시키고 updatedAt을 갱신한다', () => {
      // given
      const cartItem = new CartItem(1, 100, 200, 5, new Date(), new Date());

      // when
      cartItem.decreaseQuantity(2);

      // then
      expect(cartItem.quantity).toBe(3);
    });

    it('기본값 1만큼 감소시킨다', () => {
      // given
      const cartItem = new CartItem(1, 100, 200, 5, new Date(), new Date());

      // when
      cartItem.decreaseQuantity();

      // then
      expect(cartItem.quantity).toBe(4);
    });

    it('결과가 음수가 되면 INVALID_QUANTITY 예외를 던진다', () => {
      // given
      const cartItem = new CartItem(1, 100, 200, 2, new Date(), new Date());

      // when & then
      expect(() => cartItem.decreaseQuantity(5)).toThrow(ValidationException);
    });
  });

  describe('shouldBeRemoved', () => {
    it('수량이 1이면 true를 반환한다', () => {
      // given
      const cartItem = new CartItem(1, 100, 200, 1, new Date(), new Date());

      // when & then
      expect(cartItem.shouldBeRemoved()).toBe(true);
    });

    it('수량이 2 이상이면 false를 반환한다', () => {
      // given
      const cartItem = new CartItem(1, 100, 200, 2, new Date(), new Date());

      // when & then
      expect(cartItem.shouldBeRemoved()).toBe(false);
    });
  });
});
