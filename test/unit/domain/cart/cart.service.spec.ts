import { CartDomainService } from '@/cart/domain/services/cart.service';
import { CartItem } from '@/cart/domain/entities/cart-item.entity';
import { ICartRepository } from '@/cart/domain/interfaces/cart.repository.interface';
import {
  IProductRepository,
  IProductOptionRepository,
} from '@/product/domain/interfaces/product.repository.interface';
import { ErrorCode, ValidationException } from '@common/exception';

describe('CartDomainService', () => {
  let cartDomainService: CartDomainService;
  let mockCartRepository: jest.Mocked<ICartRepository>;
  let mockProductRepository: jest.Mocked<IProductRepository>;
  let mockProductOptionRepository: jest.Mocked<IProductOptionRepository>;

  beforeEach(() => {
    // Mock Repository 생성
    mockCartRepository = {
      findById: jest.fn(),
      findManyByUserId: jest.fn(),
      findByUserIdAndProductOptionId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteById: jest.fn(),
      deleteByUserCart: jest.fn(),
      deleteByUserId: jest.fn(),
    } as any;

    mockProductRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findByIds: jest.fn(),
      save: jest.fn(),
      findTopProducts: jest.fn(),
    } as any;

    mockProductOptionRepository = {
      findById: jest.fn(),
      findByProductId: jest.fn(),
      findByIds: jest.fn(),
      save: jest.fn(),
    } as any;

    cartDomainService = new CartDomainService(
      mockCartRepository,
      mockProductRepository,
      mockProductOptionRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addCart', () => {
    const userId = 1;
    const productOptionId = 10;
    const quantity = 2;

    it('기존 장바구니 항목이 없으면 새로운 항목을 생성한다', async () => {
      // given
      const newCartItem = new CartItem(
        1,
        userId,
        productOptionId,
        quantity,
        new Date(),
        new Date(),
      );
      mockCartRepository.findManyByUserId.mockResolvedValue([]);
      mockCartRepository.create.mockResolvedValue(newCartItem);

      // when
      await cartDomainService.addCart(userId, productOptionId, quantity);

      // then
      expect(mockCartRepository.findManyByUserId).toHaveBeenCalledWith(userId);
      expect(mockCartRepository.create).toHaveBeenCalledWith(
        userId,
        productOptionId,
        quantity,
      );
      expect(mockCartRepository.update).not.toHaveBeenCalled();
    });

    it('기존 장바구니 항목이 있으면 수량을 증가시킨다', async () => {
      // given
      const existingQuantity = 3;
      const existingCartItem = new CartItem(
        1,
        userId,
        productOptionId,
        existingQuantity,
        new Date(),
        new Date(),
      );
      mockCartRepository.findManyByUserId.mockResolvedValue([existingCartItem]);
      mockCartRepository.update.mockResolvedValue(existingCartItem);

      // when
      await cartDomainService.addCart(userId, productOptionId, quantity);

      // then
      expect(mockCartRepository.findManyByUserId).toHaveBeenCalledWith(userId);
      expect(existingCartItem.quantity).toBe(existingQuantity + quantity); // 3 + 2 = 5
      expect(mockCartRepository.update).toHaveBeenCalledWith(existingCartItem);
      expect(mockCartRepository.create).not.toHaveBeenCalled();
    });

    it('다른 상품 옵션의 기존 항목이 있어도 새 항목을 생성한다', async () => {
      // given
      const otherProductOptionId = 999;
      const existingCartItem = new CartItem(
        1,
        userId,
        otherProductOptionId,
        3,
        new Date(),
        new Date(),
      );
      const newCartItem = new CartItem(
        2,
        userId,
        productOptionId,
        quantity,
        new Date(),
        new Date(),
      );
      mockCartRepository.findManyByUserId.mockResolvedValue([existingCartItem]);
      mockCartRepository.create.mockResolvedValue(newCartItem);

      // when
      await cartDomainService.addCart(userId, productOptionId, quantity);

      // then
      expect(mockCartRepository.findManyByUserId).toHaveBeenCalledWith(userId);
      expect(mockCartRepository.create).toHaveBeenCalledWith(
        userId,
        productOptionId,
        quantity,
      );
      expect(mockCartRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('removeCart', () => {
    const userId = 1;
    const productOptionId = 10;

    it('장바구니 항목이 존재하지 않으면 CART_ITEM_NOT_FOUND 예외를 던진다', async () => {
      // given
      mockCartRepository.findManyByUserId.mockResolvedValue([]);

      // when & then
      await expect(
        cartDomainService.removeCart(userId, productOptionId),
      ).rejects.toThrow();

      try {
        await cartDomainService.removeCart(userId, productOptionId);
      } catch (error) {
        expect(error.name).toBe('ValidationException');
        expect((error as ValidationException).errorCode).toBe(
          ErrorCode.CART_ITEM_NOT_FOUND,
        );
      }

      expect(mockCartRepository.findManyByUserId).toHaveBeenCalledWith(userId);
      expect(mockCartRepository.update).not.toHaveBeenCalled();
      expect(mockCartRepository.deleteByUserCart).not.toHaveBeenCalled();
    });

    it('다른 사용자의 장바구니 항목이면 UNAUTHORIZED 예외를 던진다', async () => {
      // given
      const otherUserId = 999;
      const cartItem = new CartItem(
        1,
        otherUserId,
        productOptionId,
        2,
        new Date(),
        new Date(),
      );
      mockCartRepository.findManyByUserId.mockResolvedValue([cartItem]);

      // when & then
      await expect(
        cartDomainService.removeCart(userId, productOptionId),
      ).rejects.toThrow();

      expect(mockCartRepository.findManyByUserId).toHaveBeenCalledWith(userId);
      expect(mockCartRepository.update).not.toHaveBeenCalled();
      expect(mockCartRepository.deleteByUserCart).not.toHaveBeenCalled();
    });

    it('수량이 2 이상이면 수량을 1 감소시킨다', async () => {
      // given
      const cartItem = new CartItem(
        1,
        userId,
        productOptionId,
        3,
        new Date(),
        new Date(),
      );
      mockCartRepository.findManyByUserId.mockResolvedValue([cartItem]);
      mockCartRepository.update.mockResolvedValue(cartItem);

      // when
      await cartDomainService.removeCart(userId, productOptionId);

      // then
      expect(mockCartRepository.findManyByUserId).toHaveBeenCalledWith(userId);
      expect(cartItem.quantity).toBe(2); // 3 - 1 = 2
      expect(mockCartRepository.update).toHaveBeenCalledWith(cartItem);
      expect(mockCartRepository.deleteByUserCart).not.toHaveBeenCalled();
    });

    it('수량이 1이면 장바구니 항목을 삭제한다', async () => {
      // given
      const cartItem = new CartItem(
        1,
        userId,
        productOptionId,
        1,
        new Date(),
        new Date(),
      );
      mockCartRepository.findManyByUserId.mockResolvedValue([cartItem]);
      mockCartRepository.deleteByUserCart.mockResolvedValue(undefined);

      // when
      await cartDomainService.removeCart(userId, productOptionId);

      // then
      expect(mockCartRepository.findManyByUserId).toHaveBeenCalledWith(userId);
      expect(mockCartRepository.deleteByUserCart).toHaveBeenCalledWith(
        userId,
        productOptionId,
      );
      expect(mockCartRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('getCart', () => {
    const userId = 1;

    it('장바구니 항목이 없으면 빈 배열을 반환한다', async () => {
      // given
      mockCartRepository.findManyByUserId.mockResolvedValue([]);

      // when
      const result = await cartDomainService.getCart(userId);

      // then
      expect(result).toEqual([]);
      expect(mockCartRepository.findManyByUserId).toHaveBeenCalledWith(userId);
    });

    it('장바구니 항목들을 반환한다', async () => {
      // given
      const cartItem1 = new CartItem(1, userId, 10, 2, new Date(), new Date());
      const cartItem2 = new CartItem(2, userId, 20, 3, new Date(), new Date());
      mockCartRepository.findManyByUserId.mockResolvedValue([
        cartItem1,
        cartItem2,
      ]);

      // when
      const result = await cartDomainService.getCart(userId);

      // then
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(cartItem1);
      expect(result[1]).toBe(cartItem2);
      expect(mockCartRepository.findManyByUserId).toHaveBeenCalledWith(userId);
    });
  });
});
