import {
  CouponPrismaRepository,
  UserCouponRepository,
} from '@/coupon/infrastructure/coupon.prisma.repository';
import { Coupon } from '@/coupon/domain/entities/coupon.entity';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import {
  setupIntegrationTest,
  cleanupDatabase,
  teardownIntegrationTest,
} from './setup';

describe('CouponService Integration Tests', () => {
  let prismaService: PrismaService;
  let couponRepository: CouponPrismaRepository;

  beforeAll(async () => {
    prismaService = await setupIntegrationTest();
  }, 60000); // 60초 타임아웃

  afterAll(async () => {
    await teardownIntegrationTest();
  });

  beforeEach(async () => {
    await cleanupDatabase(prismaService);
    couponRepository = new CouponPrismaRepository(prismaService);
  });

  describe('쿠폰 발급 동시성 제어 (Coupon.issuedQuantity)', () => {
    it('동시에 100번 발급 시도 시 정확히 10개만 발급된다', async () => {
      // Given: 총 10개 쿠폰
      const coupon = await couponRepository.create(
        new Coupon(
          0,
          '선착순 쿠폰',
          30,
          10,
          0,
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          new Date(),
          new Date(),
        ),
      );

      // When: 100번 동시에 발급 시도 (트랜잭션으로 동시성 제어)
      const results = await Promise.allSettled(
        Array.from({ length: 100 }, async () => {
          return await prismaService.runInTransaction(async () => {
            const c = await couponRepository.findById(coupon.id);
            if (c) {
              c.issue();
              await couponRepository.update(c);
            }
          });
        }),
      );

      // Then: 정확히 10개만 발급 성공
      const finalCoupon = await couponRepository.findById(coupon.id);
      expect(finalCoupon!.issuedQuantity).toBe(10);
    });
  });
});
