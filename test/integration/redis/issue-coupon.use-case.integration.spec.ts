import { PrismaService } from '@common/prisma-manager/prisma.service';
import { RedisService } from '@common/redis-manager/redis.service';
import { IssueCouponUseCase } from '@/coupon/application/issue-coupon.use-case';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import {
  CouponPrismaRepository,
  UserCouponRepository,
} from '@/coupon/infrastructure/coupon.prisma.repository';
import {
  ICouponRepository,
  IUserCouponRepository,
} from '@/coupon/domain/interfaces/coupon.repository.interface';
import {
  setupDatabaseTest,
  setupRedisForTest,
  teardownIntegrationTest,
  cleanupDatabase,
} from '../setup';
import { IssueCouponCommand } from '@/coupon/application/dto/issue-coupon.dto';

describe('IssueCouponUseCase 동시성 통합 테스트', () => {
  let prismaService: PrismaService;
  let redisService: RedisService;
  let issueCouponUseCase: IssueCouponUseCase;
  let couponRepository: ICouponRepository;
  let userCouponRepository: IUserCouponRepository;

  beforeAll(async () => {
    // MySQL 및 Redis 컨테이너 시작
    prismaService = await setupDatabaseTest();
    redisService = await setupRedisForTest();

    // Repository 인스턴스 생성
    couponRepository = new CouponPrismaRepository(prismaService);
    userCouponRepository = new UserCouponRepository(prismaService);

    // Domain Service 인스턴스 생성
    const couponDomainService = new CouponDomainService(
      couponRepository,
      userCouponRepository,
    );

    // UseCase 인스턴스 생성
    issueCouponUseCase = new IssueCouponUseCase(
      couponDomainService,
      prismaService,
      redisService,
    );
  }, 120000);

  afterAll(async () => {
    await teardownIntegrationTest();
  });

  beforeEach(async () => {
    // 테스트 데이터 정리
    await cleanupDatabase(prismaService);

    // Redis 키 정리
    const client = redisService.getClient();
    const keys = await client.keys('*');
    if (keys.length > 0) {
      await client.del(keys);
    }
  });

  /**
   * 테스트용 쿠폰 생성 헬퍼
   */
  async function createTestCoupon(totalQuantity: number) {
    const coupon = await prismaService.coupons.create({
      data: {
        name: '테스트 쿠폰',
        discount_rate: 10,
        total_quantity: totalQuantity,
        issued_quantity: 0,
        expired_at: new Date('2030-12-31'),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return coupon;
  }

  /**
   * 테스트용 사용자 생성 헬퍼
   */
  async function createTestUsers(count: number) {
    const users = await Promise.all(
      Array.from({ length: count }, () =>
        prismaService.users.create({
          data: {
            balance: 0,
            created_at: new Date(),
            updated_at: new Date(),
          },
        }),
      ),
    );
    return users;
  }

  describe('Redis 분산 락을 사용한 동시성 제어', () => {
    it('동시에 여러 사용자가 같은 쿠폰을 발급받을 때 수량이 정확히 관리된다', async () => {
      // Given: 10개 수량의 쿠폰과 20명의 사용자
      const totalQuantity = 10;
      const userCount = 20;

      const coupon = await createTestCoupon(totalQuantity);
      const users = await createTestUsers(userCount);

      // When: 20명의 사용자가 동시에 쿠폰 발급 요청
      const promises = users.map((user) => {
        const command: IssueCouponCommand = {
          userId: user.id,
          couponId: coupon.id,
        };
        return issueCouponUseCase
          .execute(command)
          .then((result) => ({ success: true, result, userId: user.id }))
          .catch((error) => ({ success: false, error, userId: user.id }));
      });

      const results = await Promise.all(promises);

      // Then: 정확히 10명만 쿠폰 발급 성공
      const successResults = results.filter((r) => r.success);
      const failResults = results.filter((r) => !r.success);

      expect(successResults.length).toBe(totalQuantity);
      expect(failResults.length).toBe(userCount - totalQuantity);

      // Then: DB에서 쿠폰 발급 수량 확인
      const updatedCoupon = await prismaService.coupons.findUnique({
        where: { id: coupon.id },
      });
      expect(updatedCoupon?.issued_quantity).toBe(totalQuantity);

      // Then: 발급된 사용자 쿠폰 수 확인
      const userCoupons = await prismaService.user_coupons.findMany({
        where: { coupon_id: coupon.id },
      });
      expect(userCoupons.length).toBe(totalQuantity);

      console.log(
        `✅ 성공: ${successResults.length}명, 실패: ${failResults.length}명`,
      );
    }, 60000);

    it('같은 사용자가 동시에 같은 쿠폰을 중복 발급 시도할 때 1번만 성공한다', async () => {
      // Given: 100개 수량의 쿠폰과 1명의 사용자
      const coupon = await createTestCoupon(100);
      const [user] = await createTestUsers(1);

      // When: 동일 사용자가 10번 동시에 쿠폰 발급 요청
      const concurrentRequests = 10;
      const promises = Array.from({ length: concurrentRequests }, () => {
        const command: IssueCouponCommand = {
          userId: user.id,
          couponId: coupon.id,
        };
        return issueCouponUseCase
          .execute(command)
          .then((result) => ({ success: true, result }))
          .catch((error) => ({ success: false, error }));
      });

      const results = await Promise.all(promises);

      // Then: 정확히 1번만 성공 (중복 발급 방지)
      const successResults = results.filter((r) => r.success);
      const failResults = results.filter((r) => !r.success);

      expect(successResults.length).toBe(1);
      expect(failResults.length).toBe(concurrentRequests - 1);

      // Then: DB에서 쿠폰 발급 수량 확인
      const updatedCoupon = await prismaService.coupons.findUnique({
        where: { id: coupon.id },
      });
      expect(updatedCoupon?.issued_quantity).toBe(1);

      // Then: 사용자 쿠폰은 1개만 생성
      const userCoupons = await prismaService.user_coupons.findMany({
        where: { user_id: user.id, coupon_id: coupon.id },
      });
      expect(userCoupons.length).toBe(1);

      console.log(
        `✅ 중복 발급 방지 테스트 - 성공: ${successResults.length}번, 실패: ${failResults.length}번`,
      );
    }, 60000);

    it('수량이 정확히 1개 남았을 때 동시 요청 시 1명만 발급받는다', async () => {
      // Given: 1개 수량의 쿠폰과 10명의 사용자
      const totalQuantity = 1;
      const userCount = 10;

      const coupon = await createTestCoupon(totalQuantity);
      const users = await createTestUsers(userCount);

      // When: 10명의 사용자가 동시에 쿠폰 발급 요청
      const promises = users.map((user) => {
        const command: IssueCouponCommand = {
          userId: user.id,
          couponId: coupon.id,
        };
        return issueCouponUseCase
          .execute(command)
          .then((result) => ({ success: true, result, userId: user.id }))
          .catch((error) => ({ success: false, error, userId: user.id }));
      });

      const results = await Promise.all(promises);

      // Then: 정확히 1명만 쿠폰 발급 성공
      const successResults = results.filter((r) => r.success);
      const failResults = results.filter((r) => !r.success);

      expect(successResults.length).toBe(1);
      expect(failResults.length).toBe(userCount - 1);

      // Then: DB에서 쿠폰 발급 수량 확인 (Over-issue 방지)
      const updatedCoupon = await prismaService.coupons.findUnique({
        where: { id: coupon.id },
      });
      expect(updatedCoupon?.issued_quantity).toBe(1);
      expect(updatedCoupon?.issued_quantity).toBeLessThanOrEqual(
        updatedCoupon?.total_quantity ?? 0,
      );

      console.log(
        `✅ 마지막 1개 쿠폰 경쟁 테스트 - 성공: ${successResults.length}명`,
      );
    }, 60000);

    it('서로 다른 쿠폰은 동시에 발급받을 수 있다', async () => {
      // Given: 2개의 쿠폰과 2명의 사용자
      const coupon1 = await createTestCoupon(10);
      const coupon2 = await createTestCoupon(10);
      const users = await createTestUsers(2);

      // When: 각 사용자가 서로 다른 쿠폰을 동시에 발급 요청
      const promises = [
        issueCouponUseCase.execute({
          userId: users[0].id,
          couponId: coupon1.id,
        }),
        issueCouponUseCase.execute({
          userId: users[1].id,
          couponId: coupon2.id,
        }),
      ];

      const results = await Promise.all(promises);

      // Then: 둘 다 성공
      expect(results.length).toBe(2);
      expect(results[0].userCouponId).toBeDefined();
      expect(results[1].userCouponId).toBeDefined();

      // Then: 각 쿠폰의 발급 수량 확인
      const updatedCoupon1 = await prismaService.coupons.findUnique({
        where: { id: coupon1.id },
      });
      const updatedCoupon2 = await prismaService.coupons.findUnique({
        where: { id: coupon2.id },
      });

      expect(updatedCoupon1?.issued_quantity).toBe(1);
      expect(updatedCoupon2?.issued_quantity).toBe(1);

      console.log('✅ 서로 다른 쿠폰 동시 발급 테스트 성공');
    }, 60000);

    it('대규모 동시 요청에서도 수량 정합성이 보장된다', async () => {
      // Given: 50개 수량의 쿠폰과 100명의 사용자
      const totalQuantity = 50;
      const userCount = 100;

      const coupon = await createTestCoupon(totalQuantity);
      const users = await createTestUsers(userCount);

      // When: 100명의 사용자가 동시에 쿠폰 발급 요청
      const promises = users.map((user) => {
        const command: IssueCouponCommand = {
          userId: user.id,
          couponId: coupon.id,
        };
        return issueCouponUseCase
          .execute(command)
          .then((result) => ({ success: true, result, userId: user.id }))
          .catch((error) => ({ success: false, error, userId: user.id }));
      });

      const results = await Promise.all(promises);

      // Then: 정확히 50명만 쿠폰 발급 성공
      const successResults = results.filter((r) => r.success);
      const failResults = results.filter((r) => !r.success);

      expect(successResults.length).toBe(totalQuantity);
      expect(failResults.length).toBe(userCount - totalQuantity);

      // Then: DB에서 쿠폰 발급 수량 확인 (Over-issue 절대 방지)
      const updatedCoupon = await prismaService.coupons.findUnique({
        where: { id: coupon.id },
      });
      expect(updatedCoupon?.issued_quantity).toBe(totalQuantity);
      expect(updatedCoupon?.issued_quantity).toBeLessThanOrEqual(
        updatedCoupon?.total_quantity ?? 0,
      );

      // Then: 발급된 사용자 쿠폰 수 확인
      const userCoupons = await prismaService.user_coupons.findMany({
        where: { coupon_id: coupon.id },
      });
      expect(userCoupons.length).toBe(totalQuantity);

      // Then: 중복 발급 없음 확인 (유니크한 사용자 ID 수)
      const uniqueUserIds = new Set(userCoupons.map((uc) => uc.user_id));
      expect(uniqueUserIds.size).toBe(totalQuantity);

      console.log(
        `✅ 대규모 동시성 테스트 - 성공: ${successResults.length}명, 실패: ${failResults.length}명`,
      );
    }, 120000);
  });
});
