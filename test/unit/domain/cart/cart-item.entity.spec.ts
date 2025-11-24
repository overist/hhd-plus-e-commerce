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

  describe('validateUserId', () => {
    it('userId가 일치하면 검증을 통과한다', () => {
      // given
      const userId = 100;
      const cartItem = new CartItem(1, userId, 200, 5, new Date(), new Date());

      // when & then
      expect(() => cartItem.validateUserId(userId)).not.toThrow();
    });

    it('userId가 일치하지 않으면 UNAUTHORIZED 예외를 던진다', () => {
      // given
      const userId = 100;
      const differentUserId = 999;
      const cartItem = new CartItem(1, userId, 200, 5, new Date(), new Date());

      // when & then
      expect(() => cartItem.validateUserId(differentUserId)).toThrow(
        DomainException,
      );

      try {
        cartItem.validateUserId(differentUserId);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.UNAUTHORIZED,
        );
      }
    });
  });

  describe('updateQuantity', () => {
    it('유효한 수량으로 변경하고 updatedAt을 갱신한다', () => {
      // given
      const cartItem = new CartItem(1, 100, 200, 5, new Date(), new Date());
      const originalUpdatedAt = cartItem.updatedAt;
      const newQuantity = 10;

      // when
      cartItem.updateQuantity(newQuantity);

      // then
      expect(cartItem.quantity).toBe(newQuantity);
      expect(cartItem.updatedAt).not.toBe(originalUpdatedAt);
      expect(cartItem.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });
});
