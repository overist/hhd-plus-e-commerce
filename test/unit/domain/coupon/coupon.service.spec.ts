import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import { Coupon } from '@/coupon/domain/entities/coupon.entity';
import { UserCoupon } from '@/coupon/domain/entities/user-coupon.entity';
import {
  ICouponRepository,
  IUserCouponRepository,
} from '@/coupon/domain/interfaces/coupon.repository.interface';
import { ErrorCode, DomainException } from '@common/exception';

describe('CouponDomainService', () => {
  let couponDomainService: CouponDomainService;
  let mockCouponRepository: jest.Mocked<ICouponRepository>;
  let mockUserCouponRepository: jest.Mocked<IUserCouponRepository>;

  beforeEach(() => {
    // Mock Repository 생성
    mockCouponRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    } as any;

    mockUserCouponRepository = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByUserCoupon: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any;

    couponDomainService = new CouponDomainService(
      mockCouponRepository,
      mockUserCouponRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCoupon', () => {
    it('쿠폰 ID로 쿠폰을 조회한다', async () => {
      // given
      const couponId = 1;
      const coupon = new Coupon(
        couponId,
        '10% 할인',
        10,
        100,
        50,
        new Date('2025-12-31'),
        new Date(),
        new Date(),
      );
      mockCouponRepository.findById.mockResolvedValue(coupon);

      // when
      const result = await couponDomainService.getCoupon(couponId);

      // then
      expect(result).toBe(coupon);
      expect(mockCouponRepository.findById).toHaveBeenCalledWith(couponId);
    });

    it('존재하지 않는 쿠폰 ID로 조회하면 COUPON_NOT_FOUND 예외를 던진다', async () => {
      // given
      const couponId = 999;
      mockCouponRepository.findById.mockResolvedValue(null);

      // when & then
      await expect(couponDomainService.getCoupon(couponId)).rejects.toThrow(
        DomainException,
      );

      try {
        await couponDomainService.getCoupon(couponId);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.COUPON_NOT_FOUND,
        );
      }

      expect(mockCouponRepository.findById).toHaveBeenCalledWith(couponId);
    });
  });

  describe('getUserCoupons', () => {
    it('사용자 ID로 사용자 쿠폰 목록을 조회한다', async () => {
      // given
      const userId = 100;
      const userCoupons = [
        new UserCoupon(
          1,
          userId,
          1,
          null,
          new Date(),
          null,
          new Date('2025-12-31'),
          new Date(),
        ),
        new UserCoupon(
          2,
          userId,
          2,
          null,
          new Date(),
          null,
          new Date('2025-12-31'),
          new Date(),
        ),
      ];
      mockUserCouponRepository.findByUserId.mockResolvedValue(userCoupons);

      // when
      const result = await couponDomainService.getUserCoupons(userId);

      // then
      expect(result).toEqual(userCoupons);
      expect(mockUserCouponRepository.findByUserId).toHaveBeenCalledWith(
        userId,
      );
    });

    it('사용자 쿠폰 목록이 없으면 COUPON_INFO_NOT_FOUND 예외를 던진다', async () => {
      // given
      const userId = 100;
      mockUserCouponRepository.findByUserId.mockResolvedValue(undefined as any);

      // when & then
      await expect(couponDomainService.getUserCoupons(userId)).rejects.toThrow(
        DomainException,
      );

      try {
        await couponDomainService.getUserCoupons(userId);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.COUPON_INFO_NOT_FOUND,
        );
      }

      expect(mockUserCouponRepository.findByUserId).toHaveBeenCalledWith(
        userId,
      );
    });
  });

  describe('getUserCoupon', () => {
    it('사용자 쿠폰 ID로 사용자 쿠폰을 조회한다', async () => {
      // given
      const userCouponId = 1;
      const userCoupon = new UserCoupon(
        userCouponId,
        100,
        1,
        null,
        new Date(),
        null,
        new Date('2025-12-31'),
        new Date(),
      );
      mockUserCouponRepository.findById.mockResolvedValue(userCoupon);

      // when
      const result = await couponDomainService.getUserCoupon(userCouponId);

      // then
      expect(result).toBe(userCoupon);
      expect(mockUserCouponRepository.findById).toHaveBeenCalledWith(
        userCouponId,
      );
    });

    it('존재하지 않는 사용자 쿠폰 ID로 조회하면 COUPON_NOT_FOUND 예외를 던진다', async () => {
      // given
      const userCouponId = 999;
      mockUserCouponRepository.findById.mockResolvedValue(null);

      // when & then
      await expect(
        couponDomainService.getUserCoupon(userCouponId),
      ).rejects.toThrow(DomainException);

      try {
        await couponDomainService.getUserCoupon(userCouponId);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.COUPON_NOT_FOUND,
        );
      }

      expect(mockUserCouponRepository.findById).toHaveBeenCalledWith(
        userCouponId,
      );
    });
  });

  describe('updateUserCoupon', () => {
    it('사용자 쿠폰을 업데이트한다', async () => {
      // given
      const userCoupon = new UserCoupon(
        1,
        100,
        1,
        null,
        new Date(),
        null,
        new Date('2025-12-31'),
        new Date(),
      );
      mockUserCouponRepository.update.mockResolvedValue(userCoupon);

      // when
      const result = await couponDomainService.updateUserCoupon(userCoupon);

      // then
      expect(result).toBe(userCoupon);
      expect(mockUserCouponRepository.update).toHaveBeenCalledWith(userCoupon);
    });
  });

  describe('createUserCoupon', () => {
    it('사용자 쿠폰을 생성한다', async () => {
      // given
      const userCoupon = new UserCoupon(
        0,
        100,
        1,
        null,
        new Date(),
        null,
        new Date('2025-12-31'),
        new Date(),
      );
      const createdUserCoupon = new UserCoupon(
        1,
        100,
        1,
        null,
        userCoupon.createdAt,
        null,
        new Date('2025-12-31'),
        userCoupon.updatedAt,
      );
      mockUserCouponRepository.create.mockResolvedValue(createdUserCoupon);

      // when
      const result = await couponDomainService.createUserCoupon(userCoupon);

      // then
      expect(result).toBe(createdUserCoupon);
      expect(result.id).toBe(1);
      expect(mockUserCouponRepository.create).toHaveBeenCalledWith(userCoupon);
    });
  });
});
