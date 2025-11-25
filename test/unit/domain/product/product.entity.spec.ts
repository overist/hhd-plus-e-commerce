import { Product } from '@/product/domain/entities/product.entity';
import { ErrorCode, DomainException } from '@common/exception';

describe('Product Entity', () => {
  describe('생성자', () => {
    it('유효한 값으로 Product를 생성한다', () => {
      // given
      const id = 1;
      const name = '테스트 상품';
      const description = '상품 설명';
      const price = 10000;
      const category = '의류';
      const isAvailable = true;
      const createdAt = new Date();
      const updatedAt = new Date();

      // when
      const product = new Product(
        id,
        name,
        description,
        price,
        category,
        isAvailable,
        createdAt,
        updatedAt,
      );

      // then
      expect(product.id).toBe(id);
      expect(product.name).toBe(name);
      expect(product.description).toBe(description);
      expect(product.price).toBe(price);
      expect(product.category).toBe(category);
      expect(product.isAvailable).toBe(isAvailable);
      expect(product.createdAt).toBe(createdAt);
      expect(product.updatedAt).toBe(updatedAt);
    });

    it('가격이 음수이면 INVALID_PRICE 예외를 던진다', () => {
      // given
      const invalidPrice = -1000;

      // when & then
      expect(
        () =>
          new Product(
            1,
            '테스트 상품',
            '설명',
            invalidPrice,
            '의류',
            true,
            new Date(),
            new Date(),
          ),
      ).toThrow();

      try {
        new Product(
          1,
          '테스트 상품',
          '설명',
          invalidPrice,
          '의류',
          true,
          new Date(),
          new Date(),
        );
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_PRICE,
        );
      }
    });

    it('가격이 0이면 정상적으로 생성된다', () => {
      // given
      const zeroPrice = 0;

      // when
      const product = new Product(
        1,
        '무료 상품',
        '설명',
        zeroPrice,
        '의류',
        true,
        new Date(),
        new Date(),
      );

      // then
      expect(product.price).toBe(0);
    });
  });

  describe('validateAvailability', () => {
    it('판매 가능한 상품은 검증을 통과한다', () => {
      // given
      const product = new Product(
        1,
        '테스트 상품',
        '설명',
        10000,
        '의류',
        true,
        new Date(),
        new Date(),
      );

      // when & then
      expect(() => product.validateAvailability()).not.toThrow();
    });

    it('판매 불가능한 상품은 PRODUCT_UNAVAILABLE 예외를 던진다', () => {
      // given
      const product = new Product(
        1,
        '판매중지 상품',
        '설명',
        10000,
        '의류',
        false,
        new Date(),
        new Date(),
      );

      // when & then
      expect(() => product.validateAvailability()).toThrow();

      try {
        product.validateAvailability();
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.PRODUCT_UNAVAILABLE,
        );
      }
    });
  });

  describe('markAsUnavailable', () => {
    it('상품을 판매 중지 상태로 변경하고 updatedAt을 갱신한다', () => {
      // given
      const product = new Product(
        1,
        '테스트 상품',
        '설명',
        10000,
        '의류',
        true,
        new Date(),
        new Date(),
      );
      const originalUpdatedAt = product.updatedAt;

      // when
      product.markAsUnavailable();

      // then
      expect(product.isAvailable).toBe(false);
      expect(product.updatedAt).not.toBe(originalUpdatedAt);
      expect(product.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('markAsAvailable', () => {
    it('상품을 판매 가능 상태로 변경하고 updatedAt을 갱신한다', () => {
      // given
      const product = new Product(
        1,
        '테스트 상품',
        '설명',
        10000,
        '의류',
        false,
        new Date(),
        new Date(),
      );
      const originalUpdatedAt = product.updatedAt;

      // when
      product.markAsAvailable();

      // then
      expect(product.isAvailable).toBe(true);
      expect(product.updatedAt).not.toBe(originalUpdatedAt);
      expect(product.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });
});
