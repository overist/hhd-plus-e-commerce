import { PrismaService } from '@common/prisma-manager/prisma.service';
import { RedisService } from '@common/redis/redis.service';
import { IssueCouponUseCase } from '@/coupon/application/issue-coupon.use-case';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import {
  CouponRepository,
  UserCouponRepository,
} from '@/coupon/infrastructure/coupon.repository';
import { CouponRedisService } from '@/coupon/infrastructure/coupon.redis.service';
import {
  ICouponRepository,
  IUserCouponRepository,
} from '@/coupon/domain/interfaces/coupon.repository.interface';
import {
  setupDatabaseTest,
  setupRedisForTest,
  teardownIntegrationTest,
  cleanupDatabase,
  getRedisService,
} from '../setup';
import { IssueCouponCommand } from '@/coupon/application/dto/issue-coupon.dto';
import { Coupon } from '@/coupon/domain/entities/coupon.entity';

describe('IssueCouponUseCase Redis Lua 스크립트 통합 테스트', () => {
  let prismaService: PrismaService;
  let redisService: RedisService;
  let issueCouponUseCase: IssueCouponUseCase;
  let couponRepository: ICouponRepository;
  let userCouponRepository: IUserCouponRepository;
  let couponDomainService: CouponDomainService;
  let couponRedisService: CouponRedisService;

  const COUPON_KEY_PREFIX = 'data:coupon';
  const USER_COUPON_KEY_PREFIX = 'data:user-coupon';

  beforeAll(async () => {
    // MySQL 및 Redis 컨테이너 시작
    prismaService = await setupDatabaseTest();
    await setupRedisForTest();
    redisService = getRedisService();

    // Repository 인스턴스 생성 (순수 DB 영속성)
    couponRepository = new CouponRepository(prismaService);
    userCouponRepository = new UserCouponRepository(prismaService);

    // Domain Service 인스턴스 생성
    couponDomainService = new CouponDomainService(
      couponRepository,
      userCouponRepository,
    );

    // Infrastructure Service 인스턴스 생성 (Redis)
    couponRedisService = new CouponRedisService(redisService);

    // UseCase 인스턴스 생성 (새로운 방식: Redis Lua 스크립트 기반)
    issueCouponUseCase = new IssueCouponUseCase(
      couponDomainService,
      couponRedisService,
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
   * 테스트용 쿠폰 생성 헬퍼 (DB + Redis 모두 저장)
   */
  async function createTestCoupon(totalQuantity: number) {
    const now = new Date();
    const expiredAt = new Date('2030-12-31');

    // DB에 쿠폰 생성
    const dbCoupon = await prismaService.coupons.create({
      data: {
        name: '테스트 쿠폰',
        discount_rate: 10,
        total_quantity: totalQuantity,
        issued_quantity: 0,
        expired_at: expiredAt,
        created_at: now,
        updated_at: now,
      },
    });

    // Redis에 쿠폰 캐시 저장 (CouponRedisService 사용)
    const coupon = new Coupon(
      dbCoupon.id,
      dbCoupon.name,
      Number(dbCoupon.discount_rate),
      dbCoupon.total_quantity,
      dbCoupon.issued_quantity,
      dbCoupon.expired_at,
      dbCoupon.created_at,
      dbCoupon.updated_at,
    );
    await couponRedisService.cacheCoupon(coupon);

    return dbCoupon;
  }

  /**
   * 테스트용 만료된 쿠폰 생성 헬퍼
   */
  async function createExpiredCoupon(totalQuantity: number) {
    const now = new Date();
    const expiredAt = new Date('2020-01-01'); // 과거 날짜

    // DB에 쿠폰 생성
    const dbCoupon = await prismaService.coupons.create({
      data: {
        name: '만료된 쿠폰',
        discount_rate: 10,
        total_quantity: totalQuantity,
        issued_quantity: 0,
        expired_at: expiredAt,
        created_at: now,
        updated_at: now,
      },
    });

    // Redis에 쿠폰 저장
    const client = redisService.getClient();
    const key = `${COUPON_KEY_PREFIX}:${dbCoupon.id}`;
    await client.hset(key, {
      id: dbCoupon.id.toString(),
      name: dbCoupon.name,
      discountRate: dbCoupon.discount_rate.toString(),
      totalQuantity: dbCoupon.total_quantity.toString(),
      issuedQuantity: dbCoupon.issued_quantity.toString(),
      expiredAt: expiredAt.getTime().toString(),
      createdAt: now.getTime().toString(),
      updatedAt: now.getTime().toString(),
    });

    return dbCoupon;
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

  /**
   * Redis에서 쿠폰 발급 수량 조회 헬퍼
   */
  async function getRedisIssuedQuantity(couponId: number): Promise<number> {
    const client = redisService.getClient();
    const key = `${COUPON_KEY_PREFIX}:${couponId}`;
    const issuedQuantity = await client.hget(key, 'issuedQuantity');
    return parseInt(issuedQuantity || '0');
  }

  /**
   * Redis에서 사용자 쿠폰 존재 여부 확인 헬퍼
   */
  async function getUserCouponFromRedis(
    couponId: number,
    userId: number,
  ): Promise<boolean> {
    const client = redisService.getClient();
    const key = `${USER_COUPON_KEY_PREFIX}:${couponId}:${userId}`;
    const exists = await client.exists(key);
    return exists === 1;
  }

  describe('Redis Lua 스크립트를 사용한 원자적 쿠폰 발급', () => {
    it('동시에 여러 사용자가 같은 쿠폰을 발급받을 때 수량이 정확히 관리된다', async () => {
      // Given: 10개 수량의 쿠폰과 20명의 사용자
      const totalQuantity = 10;
      const userCount = 20;

      const coupon = await createTestCoupon(totalQuantity);
      const users = await createTestUsers(userCount);

      // When: 20명의 사용자가 동시에 쿠폰 발급 요청 (Redis Lua 스크립트)
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

      // Then: Redis에서 쿠폰 발급 수량 확인
      const redisIssuedQuantity = await getRedisIssuedQuantity(coupon.id);
      expect(redisIssuedQuantity).toBe(totalQuantity);

      // Then: Redis에 발급된 사용자 쿠폰 수 확인
      let userCouponCount = 0;
      for (const user of users) {
        if (await getUserCouponFromRedis(coupon.id, user.id)) {
          userCouponCount++;
        }
      }
      expect(userCouponCount).toBe(totalQuantity);

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

      // Then: Redis에서 쿠폰 발급 수량 확인
      const redisIssuedQuantity = await getRedisIssuedQuantity(coupon.id);
      expect(redisIssuedQuantity).toBe(1);

      // Then: Redis에 사용자 쿠폰 존재 확인
      const userCouponExists = await getUserCouponFromRedis(coupon.id, user.id);
      expect(userCouponExists).toBe(true);

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

      // Then: Redis에서 쿠폰 발급 수량 확인 (Over-issue 방지)
      const redisIssuedQuantity = await getRedisIssuedQuantity(coupon.id);
      expect(redisIssuedQuantity).toBe(1);

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
      expect(results[0].couponName).toBe('테스트 쿠폰');
      expect(results[1].couponName).toBe('테스트 쿠폰');

      // Then: 각 쿠폰의 Redis 발급 수량 확인
      const issuedQuantity1 = await getRedisIssuedQuantity(coupon1.id);
      const issuedQuantity2 = await getRedisIssuedQuantity(coupon2.id);

      expect(issuedQuantity1).toBe(1);
      expect(issuedQuantity2).toBe(1);

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

      // Then: Redis에서 쿠폰 발급 수량 확인 (Over-issue 절대 방지)
      const redisIssuedQuantity = await getRedisIssuedQuantity(coupon.id);
      expect(redisIssuedQuantity).toBe(totalQuantity);

      // Then: Redis에 발급된 사용자 쿠폰 수 확인
      let userCouponCount = 0;
      for (const user of users) {
        if (await getUserCouponFromRedis(coupon.id, user.id)) {
          userCouponCount++;
        }
      }
      expect(userCouponCount).toBe(totalQuantity);

      console.log(
        `✅ 대규모 동시성 테스트 - 성공: ${successResults.length}명, 실패: ${failResults.length}명`,
      );
    }, 120000);
  });

  describe('에러 케이스 처리', () => {
    it('존재하지 않는 쿠폰 발급 시도 시 에러가 발생한다', async () => {
      // Given: 존재하지 않는 쿠폰 ID
      const [user] = await createTestUsers(1);
      const nonExistentCouponId = 99999;

      // When & Then: COUPON_NOT_FOUND 에러 발생
      await expect(
        issueCouponUseCase.execute({
          userId: user.id,
          couponId: nonExistentCouponId,
        }),
      ).rejects.toThrow();
    }, 30000);

    it('만료된 쿠폰 발급 시도 시 에러가 발생한다', async () => {
      // Given: 만료된 쿠폰
      const expiredCoupon = await createExpiredCoupon(100);
      const [user] = await createTestUsers(1);

      // When & Then: EXPIRED_COUPON 에러 발생
      await expect(
        issueCouponUseCase.execute({
          userId: user.id,
          couponId: expiredCoupon.id,
        }),
      ).rejects.toThrow();
    }, 30000);

    it('재고가 소진된 쿠폰 발급 시도 시 에러가 발생한다', async () => {
      // Given: 재고가 0인 쿠폰
      const coupon = await createTestCoupon(1);
      const users = await createTestUsers(2);

      // 첫 번째 사용자가 쿠폰 발급 (재고 소진)
      await issueCouponUseCase.execute({
        userId: users[0].id,
        couponId: coupon.id,
      });

      // When & Then: 두 번째 사용자 발급 시도 시 COUPON_SOLD_OUT 에러
      await expect(
        issueCouponUseCase.execute({
          userId: users[1].id,
          couponId: coupon.id,
        }),
      ).rejects.toThrow();
    }, 30000);
  });

  describe('성능 테스트', () => {
    it('1000명 동시 요청 시 성능 측정', async () => {
      // Given: 100개 수량의 쿠폰과 1000명의 사용자
      const totalQuantity = 100;
      const userCount = 1000;

      const coupon = await createTestCoupon(totalQuantity);
      const users = await createTestUsers(userCount);

      // When: 1000명의 사용자가 동시에 쿠폰 발급 요청
      const startTime = Date.now();

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
      const endTime = Date.now();

      // Then: 정확히 100명만 쿠폰 발급 성공
      const successResults = results.filter((r) => r.success);
      const failResults = results.filter((r) => !r.success);

      expect(successResults.length).toBe(totalQuantity);
      expect(failResults.length).toBe(userCount - totalQuantity);

      // Then: Redis에서 쿠폰 발급 수량 확인
      const redisIssuedQuantity = await getRedisIssuedQuantity(coupon.id);
      expect(redisIssuedQuantity).toBe(totalQuantity);

      const elapsedTime = endTime - startTime;
      console.log(
        `✅ 1000명 동시 요청 처리 시간: ${elapsedTime}ms (성공: ${successResults.length}, 실패: ${failResults.length})`,
      );

      // 1000명 처리가 5초 이내여야 함
      expect(elapsedTime).toBeLessThan(5000);
    }, 120000);
  });
});
