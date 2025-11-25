import { ProductOption } from '@/product/domain/entities/product-option.entity';
import { ErrorCode, DomainException } from '@common/exception';

describe('ProductOption Entity', () => {
  describe('생성자', () => {
    it('유효한 값으로 ProductOption을 생성한다', () => {
      // given
      const id = 1;
      const productId = 100;
      const color = 'Black';
      const size = 'L';
      const stock = 50;
      const reservedStock = 10;
      const createdAt = new Date();
      const updatedAt = new Date();

      // when
      const productOption = new ProductOption(
        id,
        productId,
        color,
        size,
        stock,
        reservedStock,
        createdAt,
        updatedAt,
      );

      // then
      expect(productOption.id).toBe(id);
      expect(productOption.productId).toBe(productId);
      expect(productOption.color).toBe(color);
      expect(productOption.size).toBe(size);
      expect(productOption.stock).toBe(stock);
      expect(productOption.reservedStock).toBe(reservedStock);
      expect(productOption.createdAt).toBe(createdAt);
      expect(productOption.updatedAt).toBe(updatedAt);
    });

    it('재고가 음수이면 INVALID_STOCK_QUANTITY 예외를 던진다', () => {
      // given
      const invalidStock = -1;

      // when & then
      expect(
        () =>
          new ProductOption(
            1,
            100,
            'Black',
            'L',
            invalidStock,
            0,
            new Date(),
            new Date(),
          ),
      ).toThrow();

      try {
        new ProductOption(
          1,
          100,
          'Black',
          'L',
          invalidStock,
          0,
          new Date(),
          new Date(),
        );
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_STOCK_QUANTITY,
        );
      }
    });

    it('선점 재고가 음수이면 INVALID_STOCK_QUANTITY 예외를 던진다', () => {
      // given
      const invalidReservedStock = -1;

      // when & then
      expect(
        () =>
          new ProductOption(
            1,
            100,
            'Black',
            'L',
            50,
            invalidReservedStock,
            new Date(),
            new Date(),
          ),
      ).toThrow();

      try {
        new ProductOption(
          1,
          100,
          'Black',
          'L',
          50,
          invalidReservedStock,
          new Date(),
          new Date(),
        );
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_STOCK_QUANTITY,
        );
      }
    });

    it('선점 재고가 전체 재고를 초과하면 INVALID_STOCK_QUANTITY 예외를 던진다', () => {
      // given
      const stock = 50;
      const invalidReservedStock = 51;

      // when & then
      expect(
        () =>
          new ProductOption(
            1,
            100,
            'Black',
            'L',
            stock,
            invalidReservedStock,
            new Date(),
            new Date(),
          ),
      ).toThrow();

      try {
        new ProductOption(
          1,
          100,
          'Black',
          'L',
          stock,
          invalidReservedStock,
          new Date(),
          new Date(),
        );
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_STOCK_QUANTITY,
        );
      }
    });
  });

  describe('availableStock', () => {
    it('사용 가능한 재고를 정확하게 계산한다', () => {
      // given
      const productOption = new ProductOption(
        1,
        100,
        'Black',
        'L',
        50,
        10,
        new Date(),
        new Date(),
      );

      // when
      const available = productOption.availableStock;

      // then
      expect(available).toBe(40); // 50 - 10
    });

    it('선점 재고가 없으면 전체 재고를 반환한다', () => {
      // given
      const productOption = new ProductOption(
        1,
        100,
        'Black',
        'L',
        50,
        0,
        new Date(),
        new Date(),
      );

      // when
      const available = productOption.availableStock;

      // then
      expect(available).toBe(50);
    });

    it('전체 재고와 선점 재고가 같으면 0을 반환한다', () => {
      // given
      const productOption = new ProductOption(
        1,
        100,
        'Black',
        'L',
        50,
        50,
        new Date(),
        new Date(),
      );

      // when
      const available = productOption.availableStock;

      // then
      expect(available).toBe(0);
    });
  });

  describe('reserveStock', () => {
    it('재고를 선점하고 선점 재고를 증가시킨다', () => {
      // given
      const productOption = new ProductOption(
        1,
        100,
        'Black',
        'L',
        50,
        10,
        new Date(),
        new Date(),
      );
      const reserveQuantity = 5;

      // when
      productOption.reserveStock(reserveQuantity);

      // then
      expect(productOption.reservedStock).toBe(15); // 10 + 5
    });

    it('선점 후 선점 재고가 전체 재고를 초과하면 INVALID_STOCK_QUANTITY 예외를 던진다', () => {
      // given
      const productOption = new ProductOption(
        1,
        100,
        'Black',
        'L',
        50,
        45,
        new Date(),
        new Date(),
      );
      const reserveQuantity = 10;

      // when & then
      expect(() => productOption.reserveStock(reserveQuantity)).toThrow();

      try {
        productOption.reserveStock(reserveQuantity);
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_STOCK_QUANTITY,
        );
      }
    });
  });

  describe('decreaseStock', () => {
    it('재고와 선점 재고를 함께 차감한다', () => {
      // given
      const productOption = new ProductOption(
        1,
        100,
        'Black',
        'L',
        50,
        10,
        new Date(),
        new Date(),
      );
      const quantity = 5;

      // when
      productOption.decreaseStock(quantity);

      // then
      expect(productOption.stock).toBe(45); // 50 - 5
      expect(productOption.reservedStock).toBe(5); // 10 - 5
    });

    it('재고 차감 후 선점 재고가 음수가 되면 INVALID_STOCK_QUANTITY 예외를 던진다', () => {
      // given
      const productOption = new ProductOption(
        1,
        100,
        'Black',
        'L',
        50,
        5,
        new Date(),
        new Date(),
      );
      const quantity = 10;

      // when & then
      expect(() => productOption.decreaseStock(quantity)).toThrow();

      try {
        productOption.decreaseStock(quantity);
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_STOCK_QUANTITY,
        );
      }
    });
  });

  describe('releaseReservedStock', () => {
    it('선점 재고를 해제한다', () => {
      // given
      const productOption = new ProductOption(
        1,
        100,
        'Black',
        'L',
        50,
        10,
        new Date(),
        new Date(),
      );
      const releaseQuantity = 5;

      // when
      productOption.releaseReservedStock(releaseQuantity);

      // then
      expect(productOption.reservedStock).toBe(5); // 10 - 5
      expect(productOption.stock).toBe(50); // 변경 없음
    });

    it('선점 재고 해제 후 선점 재고가 음수가 되면 INVALID_STOCK_QUANTITY 예외를 던진다', () => {
      // given
      const productOption = new ProductOption(
        1,
        100,
        'Black',
        'L',
        50,
        10,
        new Date(),
        new Date(),
      );
      const releaseQuantity = 15;

      // when & then
      expect(() =>
        productOption.releaseReservedStock(releaseQuantity),
      ).toThrow();

      try {
        productOption.releaseReservedStock(releaseQuantity);
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_STOCK_QUANTITY,
        );
      }
    });
  });

  describe('adjustStock', () => {
    it('재고를 조정한다', () => {
      // given
      const productOption = new ProductOption(
        1,
        100,
        'Black',
        'L',
        50,
        10,
        new Date(),
        new Date(),
      );
      const newStock = 100;

      // when
      productOption.adjustStock(newStock);

      // then
      expect(productOption.stock).toBe(100);
      expect(productOption.reservedStock).toBe(10); // 변경 없음
    });

    it('재고 조정 후 선점 재고가 전체 재고를 초과하면 INVALID_STOCK_QUANTITY 예외를 던진다', () => {
      // given
      const productOption = new ProductOption(
        1,
        100,
        'Black',
        'L',
        50,
        30,
        new Date(),
        new Date(),
      );
      const newStock = 20; // 선점 재고(30)보다 작음

      // when & then
      expect(() => productOption.adjustStock(newStock)).toThrow();

      try {
        productOption.adjustStock(newStock);
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_STOCK_QUANTITY,
        );
      }
    });

    it('재고를 음수로 조정하면 INVALID_STOCK_QUANTITY 예외를 던진다', () => {
      // given
      const productOption = new ProductOption(
        1,
        100,
        'Black',
        'L',
        50,
        0,
        new Date(),
        new Date(),
      );
      const newStock = -10;

      // when & then
      expect(() => productOption.adjustStock(newStock)).toThrow();

      try {
        productOption.adjustStock(newStock);
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_STOCK_QUANTITY,
        );
      }
    });
  });
});
