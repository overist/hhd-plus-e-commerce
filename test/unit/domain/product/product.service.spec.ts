import { ProductDomainService } from '@/product/domain/services/product.service';
import { Product } from '@/product/domain/entities/product.entity';
import { ProductOption } from '@/product/domain/entities/product-option.entity';
import { ProductSalesRanking } from '@/product/domain/entities/product-sales.vo';
import { OrderItem } from '@/order/domain/entities/order-item.entity';
import {
  IProductRepository,
  IProductOptionRepository,
  IProductSalesRankingRepository,
} from '@/product/domain/interfaces/product.repository.interface';
import { ErrorCode, DomainException } from '@common/exception';

describe('ProductDomainService', () => {
  let productDomainService: ProductDomainService;
  let mockProductRepository: jest.Mocked<IProductRepository>;
  let mockProductOptionRepository: jest.Mocked<IProductOptionRepository>;
  let mockProductSalesRankingRepository: jest.Mocked<IProductSalesRankingRepository>;

  beforeEach(() => {
    // Mock Repository 생성
    mockProductRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findByIds: jest.fn(),
      save: jest.fn(),
      findTopProducts: jest.fn(),
    } as any;

    mockProductOptionRepository = {
      findById: jest.fn(),
      findManyByProductId: jest.fn(),
      findByIds: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as any;

    mockProductSalesRankingRepository = {
      recordSales: jest.fn(),
      findRankByDate: jest.fn(),
    } as any;

    productDomainService = new ProductDomainService(
      mockProductRepository,
      mockProductOptionRepository,
      mockProductSalesRankingRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProductsOnSale', () => {
    it('판매 가능한 상품 목록만 반환한다', async () => {
      // given
      const products = [
        new Product(
          1,
          '상품1',
          '설명1',
          10000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
        new Product(
          2,
          '상품2',
          '설명2',
          20000,
          '의류',
          false,
          new Date(),
          new Date(),
        ),
        new Product(
          3,
          '상품3',
          '설명3',
          30000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
      ];
      mockProductRepository.findAll.mockResolvedValue(products);

      // when
      const result = await productDomainService.getProductsOnSale();

      // then
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(3);
      expect(mockProductRepository.findAll).toHaveBeenCalled();
    });

    it('모든 상품이 판매 불가능하면 빈 배열을 반환한다', async () => {
      // given
      const products = [
        new Product(
          1,
          '상품1',
          '설명1',
          10000,
          '의류',
          false,
          new Date(),
          new Date(),
        ),
        new Product(
          2,
          '상품2',
          '설명2',
          20000,
          '의류',
          false,
          new Date(),
          new Date(),
        ),
      ];
      mockProductRepository.findAll.mockResolvedValue(products);

      // when
      const result = await productDomainService.getProductsOnSale();

      // then
      expect(result).toHaveLength(0);
    });
  });

  describe('getProduct', () => {
    it('상품 ID로 상품을 조회한다', async () => {
      // given
      const productId = 1;
      const product = new Product(
        productId,
        '테스트 상품',
        '설명',
        10000,
        '의류',
        true,
        new Date(),
        new Date(),
      );
      mockProductRepository.findById.mockResolvedValue(product);

      // when
      const result = await productDomainService.getProduct(productId);

      // then
      expect(result).toBe(product);
      expect(mockProductRepository.findById).toHaveBeenCalledWith(productId);
    });

    it('존재하지 않는 상품 ID로 조회하면 PRODUCT_NOT_FOUND 예외를 던진다', async () => {
      // given
      const productId = 999;
      mockProductRepository.findById.mockResolvedValue(null);

      // when & then
      await expect(
        productDomainService.getProduct(productId),
      ).rejects.toThrow();

      try {
        await productDomainService.getProduct(productId);
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.PRODUCT_NOT_FOUND,
        );
      }

      expect(mockProductRepository.findById).toHaveBeenCalledWith(productId);
    });
  });

  describe('getProductOptions', () => {
    it('상품 ID로 상품 옵션 목록을 조회한다', async () => {
      // given
      const productId = 1;
      const options = [
        new ProductOption(
          1,
          productId,
          'Black',
          'L',
          50,
          10,
          new Date(),
          new Date(),
        ),
        new ProductOption(
          2,
          productId,
          'White',
          'M',
          30,
          5,
          new Date(),
          new Date(),
        ),
      ];
      mockProductOptionRepository.findManyByProductId.mockResolvedValue(
        options,
      );

      // when
      const result = await productDomainService.getProductOptions(productId);

      // then
      expect(result).toEqual(options);
      expect(
        mockProductOptionRepository.findManyByProductId,
      ).toHaveBeenCalledWith(productId);
    });

    it('상품 옵션이 없으면 빈 배열을 반환한다', async () => {
      // given
      const productId = 1;
      mockProductOptionRepository.findManyByProductId.mockResolvedValue([]);

      // when
      const result = await productDomainService.getProductOptions(productId);

      // then
      expect(result).toEqual([]);
    });
  });

  describe('getProductOption', () => {
    it('상품 옵션 ID로 상품 옵션을 조회한다', async () => {
      // given
      const productOptionId = 1;
      const option = new ProductOption(
        productOptionId,
        100,
        'Black',
        'L',
        50,
        10,
        new Date(),
        new Date(),
      );
      mockProductOptionRepository.findById.mockResolvedValue(option);

      // when
      const result =
        await productDomainService.getProductOption(productOptionId);

      // then
      expect(result).toBe(option);
      expect(mockProductOptionRepository.findById).toHaveBeenCalledWith(
        productOptionId,
      );
    });

    it('존재하지 않는 상품 옵션 ID로 조회하면 PRODUCT_OPTION_NOT_FOUND 예외를 던진다', async () => {
      // given
      const productOptionId = 999;
      mockProductOptionRepository.findById.mockResolvedValue(null);

      // when & then
      await expect(
        productDomainService.getProductOption(productOptionId),
      ).rejects.toThrow();

      try {
        await productDomainService.getProductOption(productOptionId);
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.PRODUCT_OPTION_NOT_FOUND,
        );
      }

      expect(mockProductOptionRepository.findById).toHaveBeenCalledWith(
        productOptionId,
      );
    });
  });

  describe('getTopProducts', () => {
    it('인기 상품 판매 랭킹을 조회한다', async () => {
      // given
      const count = 5;
      const days = 3;
      const todayRank = [
        new ProductSalesRanking(100, 50),
        new ProductSalesRanking(101, 30),
      ];
      const yesterdayRank = [
        new ProductSalesRanking(100, 40),
        new ProductSalesRanking(102, 20),
      ];
      const twoDaysAgoRank = [
        new ProductSalesRanking(101, 25),
        new ProductSalesRanking(102, 15),
      ];

      mockProductSalesRankingRepository.findRankByDate
        .mockResolvedValueOnce(todayRank)
        .mockResolvedValueOnce(yesterdayRank)
        .mockResolvedValueOnce(twoDaysAgoRank);

      // when
      const result = await productDomainService.getTopProducts(count, days);

      // then
      expect(result).toHaveLength(3);
      // productOptionId 100: 50 + 40 = 90
      // productOptionId 101: 30 + 25 = 55
      // productOptionId 102: 20 + 15 = 35
      expect(result[0].productOptionId).toBe(100);
      expect(result[0].salesCount).toBe(90);
      expect(result[1].productOptionId).toBe(101);
      expect(result[1].salesCount).toBe(55);
      expect(result[2].productOptionId).toBe(102);
      expect(result[2].salesCount).toBe(35);
      expect(
        mockProductSalesRankingRepository.findRankByDate,
      ).toHaveBeenCalledTimes(3);
    });

    it('count가 0 이하이면 INVALID_ARGUMENT 예외를 던진다', async () => {
      // given
      const invalidCount = 0;

      // when & then
      await expect(
        productDomainService.getTopProducts(invalidCount),
      ).rejects.toThrow();

      try {
        await productDomainService.getTopProducts(invalidCount);
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_ARGUMENT,
        );
      }

      expect(
        mockProductSalesRankingRepository.findRankByDate,
      ).not.toHaveBeenCalled();
    });
  });

  describe('updateProductOptionStock', () => {
    it('재고를 증가시킨다', async () => {
      // given
      const productOptionId = 1;
      const option = new ProductOption(
        productOptionId,
        100,
        'Black',
        'L',
        50,
        10,
        new Date(),
        new Date(),
      );
      mockProductOptionRepository.findById.mockResolvedValue(option);
      mockProductOptionRepository.update.mockResolvedValue(option);

      // when
      await productDomainService.updateProductOptionStock(
        productOptionId,
        'increase',
        20,
      );

      // then
      expect(option.stock).toBe(70); // 50 + 20
      expect(mockProductOptionRepository.update).toHaveBeenCalledWith(option);
    });

    it('재고를 감소시킨다', async () => {
      // given
      const productOptionId = 1;
      const option = new ProductOption(
        productOptionId,
        100,
        'Black',
        'L',
        50,
        10,
        new Date(),
        new Date(),
      );
      mockProductOptionRepository.findById.mockResolvedValue(option);
      mockProductOptionRepository.update.mockResolvedValue(option);

      // when
      await productDomainService.updateProductOptionStock(
        productOptionId,
        'decrease',
        20,
      );

      // then
      expect(option.stock).toBe(30); // 50 - 20
      expect(mockProductOptionRepository.update).toHaveBeenCalledWith(option);
    });

    it('존재하지 않는 상품 옵션 ID로 업데이트하면 PRODUCT_OPTION_NOT_FOUND 예외를 던진다', async () => {
      // given
      const productOptionId = 999;
      mockProductOptionRepository.findById.mockResolvedValue(null);

      // when & then
      await expect(
        productDomainService.updateProductOptionStock(
          productOptionId,
          'increase',
          10,
        ),
      ).rejects.toThrow();

      try {
        await productDomainService.updateProductOptionStock(
          productOptionId,
          'increase',
          10,
        );
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.PRODUCT_OPTION_NOT_FOUND,
        );
      }

      expect(mockProductOptionRepository.update).not.toHaveBeenCalled();
    });

    it('재고보다 많은 수량을 감소시키려 하면 INSUFFICIENT_STOCK 예외를 던진다', async () => {
      // given
      const productOptionId = 1;
      const option = new ProductOption(
        productOptionId,
        100,
        'Black',
        'L',
        50,
        10,
        new Date(),
        new Date(),
      );
      mockProductOptionRepository.findById.mockResolvedValue(option);

      // when & then
      await expect(
        productDomainService.updateProductOptionStock(
          productOptionId,
          'decrease',
          60,
        ),
      ).rejects.toThrow();

      try {
        await productDomainService.updateProductOptionStock(
          productOptionId,
          'decrease',
          60,
        );
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INSUFFICIENT_STOCK,
        );
      }

      expect(mockProductOptionRepository.update).not.toHaveBeenCalled();
    });

    it('잘못된 operation을 전달하면 INVALID_ARGUMENT 예외를 던진다', async () => {
      // given
      const productOptionId = 1;
      const option = new ProductOption(
        productOptionId,
        100,
        'Black',
        'L',
        50,
        10,
        new Date(),
        new Date(),
      );
      mockProductOptionRepository.findById.mockResolvedValue(option);

      // when & then
      await expect(
        productDomainService.updateProductOptionStock(
          productOptionId,
          'invalid' as any,
          10,
        ),
      ).rejects.toThrow();

      try {
        await productDomainService.updateProductOptionStock(
          productOptionId,
          'invalid' as any,
          10,
        );
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.INVALID_ARGUMENT,
        );
      }

      expect(mockProductOptionRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('reserveProductsForOrder', () => {
    it('주문용 상품 정보를 조회하고 재고를 선점한다', async () => {
      // given
      const items = [
        { productOptionId: 1, quantity: 2 },
        { productOptionId: 2, quantity: 3 },
      ];

      const product1 = new Product(
        100,
        '상품1',
        '설명1',
        10000,
        '의류',
        true,
        new Date(),
        new Date(),
      );
      const product2 = new Product(
        101,
        '상품2',
        '설명2',
        20000,
        '의류',
        true,
        new Date(),
        new Date(),
      );

      const option1 = new ProductOption(
        1,
        100,
        'Black',
        'L',
        50,
        10,
        new Date(),
        new Date(),
      );
      const option2 = new ProductOption(
        2,
        101,
        'White',
        'M',
        30,
        5,
        new Date(),
        new Date(),
      );

      mockProductOptionRepository.findById
        .mockResolvedValueOnce(option1)
        .mockResolvedValueOnce(option2);
      mockProductRepository.findById
        .mockResolvedValueOnce(product1)
        .mockResolvedValueOnce(product2);
      mockProductOptionRepository.update.mockResolvedValue(option1);

      // when
      const result = await productDomainService.reserveProductsForOrder(items);

      // then
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        productName: '상품1',
        price: 10000,
        productOptionId: 1,
        quantity: 2,
      });
      expect(result[1]).toEqual({
        productName: '상품2',
        price: 20000,
        productOptionId: 2,
        quantity: 3,
      });
      expect(option1.reservedStock).toBe(12); // 10 + 2
      expect(option2.reservedStock).toBe(8); // 5 + 3
      expect(mockProductOptionRepository.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('recordSales', () => {
    it('given: 주문 아이템 배열이 주어짐 / when: recordSales 메서드를 호출함 / then: productSalesRankingRepository.recordSales가 호출됨', () => {
      // given
      const orderItems = [
        new OrderItem(1, 1, 101, '상품1', 5000, 2, 10000, new Date()),
        new OrderItem(2, 1, 102, '상품2', 3000, 3, 9000, new Date()),
      ];

      // when
      productDomainService.recordSales(orderItems);

      // then
      expect(
        mockProductSalesRankingRepository.recordSales,
      ).toHaveBeenCalledWith(orderItems);
      expect(
        mockProductSalesRankingRepository.recordSales,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSalesRankingDays', () => {
    it('given: count와 days가 주어짐 / when: getSalesRankingDays 메서드를 호출함 / then: N일간 판매 랭킹을 집계하여 반환함', async () => {
      // given
      const count = 5;
      const days = 3;
      const todayRank = [
        new ProductSalesRanking(1, 10),
        new ProductSalesRanking(2, 5),
      ];
      const yesterdayRank = [
        new ProductSalesRanking(1, 8),
        new ProductSalesRanking(3, 12),
      ];
      const twoDaysAgoRank = [
        new ProductSalesRanking(2, 7),
        new ProductSalesRanking(3, 3),
      ];

      mockProductSalesRankingRepository.findRankByDate
        .mockResolvedValueOnce(todayRank)
        .mockResolvedValueOnce(yesterdayRank)
        .mockResolvedValueOnce(twoDaysAgoRank);

      // when
      const result = await productDomainService.getSalesRankingDays(
        count,
        days,
      );

      // then
      expect(result).toHaveLength(3);
      // productOptionId 1: 10 + 8 = 18
      // productOptionId 3: 12 + 3 = 15
      // productOptionId 2: 5 + 7 = 12
      expect(result[0].productOptionId).toBe(1);
      expect(result[0].salesCount).toBe(18);
      expect(result[1].productOptionId).toBe(3);
      expect(result[1].salesCount).toBe(15);
      expect(result[2].productOptionId).toBe(2);
      expect(result[2].salesCount).toBe(12);
      expect(
        mockProductSalesRankingRepository.findRankByDate,
      ).toHaveBeenCalledTimes(3);
    });

    it('given: days가 30일 초과임 / when: getSalesRankingDays 메서드를 호출함 / then: INVALID_ARGUMENT 예외를 발생시킴', async () => {
      // given
      const count = 5;
      const invalidDays = 31;

      // when & then
      await expect(
        productDomainService.getSalesRankingDays(count, invalidDays),
      ).rejects.toThrow();

      try {
        await productDomainService.getSalesRankingDays(count, invalidDays);
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect(error.errorCode).toBe(ErrorCode.INVALID_ARGUMENT);
      }
    });
  });
});
