import { CartDomainService } from '@/cart/domain/services/cart.service';
import { CartItem } from '@/cart/domain/entities/cart-item.entity';
import { ICartRepository } from '@/cart/domain/interfaces/cart.repository.interface';
import { ErrorCode, DomainException } from '@common/exception';

describe('CartDomainService', () => {
  let cartDomainService: CartDomainService;
  let mockCartRepository: jest.Mocked<ICartRepository>;

  beforeEach(() => {
    mockCartRepository = {
      findById: jest.fn(),
      findManyByUserId: jest.fn(),
      findByUserIdAndProductOptionId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    cartDomainService = new CartDomainService(mockCartRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addOrIncreaseQuantity', () => {
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
      mockCartRepository.findByUserIdAndProductOptionId.mockResolvedValue(null);
      mockCartRepository.create.mockResolvedValue(newCartItem);

      // when
      await cartDomainService.addOrIncreaseQuantity(
        userId,
        productOptionId,
        quantity,
      );

      // then
      expect(
        mockCartRepository.findByUserIdAndProductOptionId,
      ).toHaveBeenCalledWith(userId, productOptionId);
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
      mockCartRepository.findByUserIdAndProductOptionId.mockResolvedValue(
        existingCartItem,
      );
      mockCartRepository.update.mockResolvedValue(existingCartItem);

      // when
      await cartDomainService.addOrIncreaseQuantity(
        userId,
        productOptionId,
        quantity,
      );

      // then
      expect(
        mockCartRepository.findByUserIdAndProductOptionId,
      ).toHaveBeenCalledWith(userId, productOptionId);
      expect(existingCartItem.quantity).toBe(existingQuantity + quantity); // 3 + 2 = 5
      expect(mockCartRepository.update).toHaveBeenCalledWith(existingCartItem);
      expect(mockCartRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('decreaseQuantityOrRemove', () => {
    const userId = 1;
    const productOptionId = 10;

    it('장바구니 항목이 존재하지 않으면 CART_ITEM_NOT_FOUND 예외를 던진다', async () => {
      // given
      mockCartRepository.findByUserIdAndProductOptionId.mockResolvedValue(null);

      // when & then
      await expect(
        cartDomainService.decreaseQuantityOrRemove(userId, productOptionId),
      ).rejects.toThrow(DomainException);

      try {
        await cartDomainService.decreaseQuantityOrRemove(
          userId,
          productOptionId,
        );
      } catch (error) {
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.CART_ITEM_NOT_FOUND,
        );
      }
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
      mockCartRepository.findByUserIdAndProductOptionId.mockResolvedValue(
        cartItem,
      );

      // when & then
      await expect(
        cartDomainService.decreaseQuantityOrRemove(userId, productOptionId),
      ).rejects.toThrow();

      expect(mockCartRepository.update).not.toHaveBeenCalled();
      expect(mockCartRepository.delete).not.toHaveBeenCalled();
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
      mockCartRepository.findByUserIdAndProductOptionId.mockResolvedValue(
        cartItem,
      );
      mockCartRepository.update.mockResolvedValue(cartItem);

      // when
      await cartDomainService.decreaseQuantityOrRemove(userId, productOptionId);

      // then
      expect(cartItem.quantity).toBe(2); // 3 - 1 = 2
      expect(mockCartRepository.update).toHaveBeenCalledWith(cartItem);
      expect(mockCartRepository.delete).not.toHaveBeenCalled();
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
      mockCartRepository.findByUserIdAndProductOptionId.mockResolvedValue(
        cartItem,
      );
      mockCartRepository.delete.mockResolvedValue(undefined);

      // when
      await cartDomainService.decreaseQuantityOrRemove(userId, productOptionId);

      // then
      expect(mockCartRepository.delete).toHaveBeenCalledWith(cartItem.id);
      expect(mockCartRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('getCartItems', () => {
    const userId = 1;

    it('장바구니 항목이 없으면 빈 배열을 반환한다', async () => {
      // given
      mockCartRepository.findManyByUserId.mockResolvedValue([]);

      // when
      const result = await cartDomainService.getCartItems(userId);

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
      const result = await cartDomainService.getCartItems(userId);

      // then
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(cartItem1);
      expect(result[1]).toBe(cartItem2);
      expect(mockCartRepository.findManyByUserId).toHaveBeenCalledWith(userId);
    });
  });
});
