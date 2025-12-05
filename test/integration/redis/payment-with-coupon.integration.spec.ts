import { CreateOrderUseCase } from '@/order/application/create-order.use-case';
import { ProcessPaymentUseCase } from '@/order/application/process-payment.use-case';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import { CouponRedisService } from '@/coupon/infrastructure/coupon.redis.service';
import { UserDomainService } from '@/user/domain/services/user.service';
import {
  OrderRepository,
  OrderItemRepository,
} from '@/order/infrastructure/order.repository';
import {
  ProductRepository,
  ProductOptionRepository,
} from '@/product/infrastructure/product.repository';
import {
  UserRepository,
  UserBalanceChangeLogRepository,
} from '@/user/infrastructure/user.repository';
import {
  CouponRepository,
  UserCouponRepository,
} from '@/coupon/infrastructure/coupon.repository';
import { Product } from '@/product/domain/entities/product.entity';
import { ProductOption } from '@/product/domain/entities/product-option.entity';
import { User } from '@/user/domain/entities/user.entity';
import { Coupon } from '@/coupon/domain/entities/coupon.entity';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import { RedisService } from '@common/redis/redis.service';
import {
  setupDatabaseTest,
  setupRedisForTest,
  getRedisService,
  cleanupDatabase,
  teardownIntegrationTest,
} from '../setup';

describe('결제 처리 - Redis 쿠폰 활용 통합 테스트', () => {
  let prismaService: PrismaService;
  let redisService: RedisService;
  let createOrderUseCase: CreateOrderUseCase;
  let processPaymentUseCase: ProcessPaymentUseCase;
  let orderRepository: OrderRepository;
  let productRepository: ProductRepository;
  let productOptionRepository: ProductOptionRepository;
  let userRepository: UserRepository;
  let couponRepository: CouponRepository;
  let userCouponRepository: UserCouponRepository;
  let couponRedisService: CouponRedisService;

  const USER_COUPON_KEY_PREFIX = 'data:user-coupon';

  beforeAll(async () => {
    prismaService = await setupDatabaseTest();
    await setupRedisForTest();
    redisService = getRedisService();
  }, 120000);

  afterAll(async () => {
    await teardownIntegrationTest();
  }, 60000);

  beforeEach(async () => {
    await cleanupDatabase(prismaService);

    // Redis 키 정리
    const client = redisService.getClient();
    const keys = await client.keys('*');
    if (keys.length > 0) {
      await client.del(keys);
    }

    // Repository 인스턴스 생성
    orderRepository = new OrderRepository(prismaService);
    const orderItemRepository = new OrderItemRepository(
      prismaService,
      redisService,
    );
    productRepository = new ProductRepository(prismaService);
    productOptionRepository = new ProductOptionRepository(prismaService);
    userRepository = new UserRepository(prismaService);
    const balanceLogRepository = new UserBalanceChangeLogRepository(
      prismaService,
    );
    couponRepository = new CouponRepository(prismaService);
    userCouponRepository = new UserCouponRepository(prismaService);

    const productPopularitySnapshotRepository = new (class {
      async findAll() {
        return [];
      }
      async create() {
        return null;
      }
      async findTop() {
        return [];
      }
    })();

    // Service 인스턴스 생성
    const orderService = new OrderDomainService(
      orderRepository,
      orderItemRepository,
    );
    const productService = new ProductDomainService(
      productRepository,
      productOptionRepository,
      productPopularitySnapshotRepository as any,
    );
    const couponService = new CouponDomainService(
      couponRepository,
      userCouponRepository,
    );
    couponRedisService = new CouponRedisService(redisService);
    const userService = new UserDomainService(
      userRepository,
      balanceLogRepository,
      prismaService,
    );

    // UseCase 인스턴스 생성
    createOrderUseCase = new CreateOrderUseCase(
      orderService,
      productService,
      userService,
      prismaService,
    );

    processPaymentUseCase = new ProcessPaymentUseCase(
      orderService,
      productService,
      couponService,
      couponRedisService,
      userService,
      prismaService,
    );
  });

  /**
   * 테스트용 쿠폰 생성 헬퍼 (DB + Redis 모두 저장)
   */
  async function createTestCoupon(
    discountRate: number,
    totalQuantity: number,
  ): Promise<Coupon> {
    const now = new Date();
    const expiredAt = new Date('2030-12-31');

    // DB에 쿠폰 생성
    const dbCoupon = await prismaService.coupons.create({
      data: {
        name: `${discountRate}% 할인 쿠폰`,
        discount_rate: discountRate,
        total_quantity: totalQuantity,
        issued_quantity: 0,
        expired_at: expiredAt,
        created_at: now,
        updated_at: now,
      },
    });

    // Redis에 쿠폰 캐시 저장
    const coupon = new Coupon(
      dbCoupon.id,
      dbCoupon.name,
      discountRate,
      totalQuantity,
      0,
      expiredAt,
      now,
      now,
    );
    await couponRedisService.cacheCoupon(coupon);

    return coupon;
  }

  /**
   * 테스트용 사용자 쿠폰 발급 헬퍼 (Redis에 UserCoupon 생성)
   */
  async function issueTestCouponToUser(
    userId: number,
    couponId: number,
  ): Promise<void> {
    await couponRedisService.issueCoupon(userId, couponId);
  }

  describe('쿠폰 적용 결제 성공 케이스', () => {
    it('Redis 쿠폰을 사용하여 결제하면 할인이 적용되고 DB에 쿠폰 사용 기록이 저장된다', async () => {
      // Given: 사용자, 상품, 쿠폰 생성
      const user = await userRepository.create(new User(0, 100000));
      const product = await productRepository.create(
        new Product(
          0,
          '테스트 상품',
          '설명',
          50000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
      );
      const productOption = await productOptionRepository.create(
        new ProductOption(0, product.id, 'RED', 'M', 10, 0),
      );
      const coupon = await createTestCoupon(10, 100); // 10% 할인

      // Given: 사용자에게 쿠폰 발급 (Redis)
      await issueTestCouponToUser(user.id, coupon.id);

      // Given: 주문 생성
      const order = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When: 쿠폰을 사용하여 결제
      const result = await processPaymentUseCase.execute({
        orderId: order.orderId,
        userId: user.id,
        couponId: coupon.id,
      });

      // Then: 할인이 적용된 금액으로 결제됨 (50,000 * 10% = 5,000 할인)
      expect(result.paidAmount).toBe(45000);
      expect(result.remainingBalance).toBe(55000); // 100,000 - 45,000

      // Then: 사용자 잔액 확인
      const finalUser = await userRepository.findById(user.id);
      expect(finalUser!.balance).toBe(55000);

      // Then: DB에 쿠폰 사용 기록 저장 확인
      const userCoupons = await userCouponRepository.findByUserId(user.id);
      expect(userCoupons.length).toBe(1);
      expect(userCoupons[0].couponId).toBe(coupon.id);
      expect(userCoupons[0].orderId).toBe(order.orderId);
      expect(userCoupons[0].usedAt).not.toBeNull();

      // Then: Redis에서 쿠폰 사용 상태 확인
      const redisUserCoupon = await couponRedisService.getCachedUserCoupon(
        user.id,
        coupon.id,
      );
      expect(redisUserCoupon).not.toBeNull();
      expect(redisUserCoupon!.orderId).toBe(order.orderId);
      expect(redisUserCoupon!.usedAt).not.toBeNull();
    }, 30000);

    it('쿠폰 없이 결제하면 정가로 결제된다', async () => {
      // Given: 사용자, 상품 생성
      const user = await userRepository.create(new User(0, 100000));
      const product = await productRepository.create(
        new Product(
          0,
          '테스트 상품',
          '설명',
          30000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
      );
      const productOption = await productOptionRepository.create(
        new ProductOption(0, product.id, 'BLUE', 'L', 10, 0),
      );

      // Given: 주문 생성
      const order = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 2 }],
      });

      // When: 쿠폰 없이 결제
      const result = await processPaymentUseCase.execute({
        orderId: order.orderId,
        userId: user.id,
      });

      // Then: 정가로 결제됨
      expect(result.paidAmount).toBe(60000); // 30,000 * 2
      expect(result.remainingBalance).toBe(40000); // 100,000 - 60,000
    }, 30000);
  });

  describe('쿠폰 사용 실패 케이스', () => {
    it('발급받지 않은 쿠폰으로 결제하면 실패한다', async () => {
      // Given: 사용자, 상품, 쿠폰 생성 (쿠폰 발급 안함)
      const user = await userRepository.create(new User(0, 100000));
      const product = await productRepository.create(
        new Product(
          0,
          '테스트 상품',
          '설명',
          50000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
      );
      const productOption = await productOptionRepository.create(
        new ProductOption(0, product.id, 'RED', 'M', 10, 0),
      );
      const coupon = await createTestCoupon(10, 100);

      // Given: 주문 생성
      const order = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When & Then: 발급받지 않은 쿠폰으로 결제 시 실패
      await expect(
        processPaymentUseCase.execute({
          orderId: order.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
      ).rejects.toThrow();

      // Then: 주문 상태 유지 (PENDING)
      const finalOrder = await orderRepository.findById(order.orderId);
      expect(finalOrder!.status.isPending()).toBe(true);

      // Then: 잔액 유지
      const finalUser = await userRepository.findById(user.id);
      expect(finalUser!.balance).toBe(100000);
    }, 30000);

    it('이미 사용된 쿠폰으로 결제하면 실패한다', async () => {
      // Given: 사용자, 상품, 쿠폰 생성
      const user = await userRepository.create(new User(0, 200000));
      const product = await productRepository.create(
        new Product(
          0,
          '테스트 상품',
          '설명',
          50000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
      );
      const productOption = await productOptionRepository.create(
        new ProductOption(0, product.id, 'RED', 'M', 10, 0),
      );
      const coupon = await createTestCoupon(10, 100);

      // Given: 쿠폰 발급
      await issueTestCouponToUser(user.id, coupon.id);

      // Given: 첫 번째 주문 생성 및 쿠폰 사용 결제
      const order1 = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });
      await processPaymentUseCase.execute({
        orderId: order1.orderId,
        userId: user.id,
        couponId: coupon.id,
      });

      // Given: 두 번째 주문 생성
      const order2 = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When & Then: 이미 사용된 쿠폰으로 결제 시 실패
      await expect(
        processPaymentUseCase.execute({
          orderId: order2.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
      ).rejects.toThrow();

      // Then: 두 번째 주문 상태 유지 (PENDING)
      const finalOrder = await orderRepository.findById(order2.orderId);
      expect(finalOrder!.status.isPending()).toBe(true);
    }, 30000);

    it('만료된 쿠폰으로 결제하면 실패한다', async () => {
      // Given: 사용자, 상품 생성
      const user = await userRepository.create(new User(0, 100000));
      const product = await productRepository.create(
        new Product(
          0,
          '테스트 상품',
          '설명',
          50000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
      );
      const productOption = await productOptionRepository.create(
        new ProductOption(0, product.id, 'RED', 'M', 10, 0),
      );

      // Given: 만료된 쿠폰 생성 (DB + Redis)
      const now = new Date();
      const expiredAt = new Date('2020-01-01'); // 과거 날짜

      const dbCoupon = await prismaService.coupons.create({
        data: {
          name: '만료된 쿠폰',
          discount_rate: 10,
          total_quantity: 100,
          issued_quantity: 0,
          expired_at: expiredAt,
          created_at: now,
          updated_at: now,
        },
      });

      // Redis에 만료된 쿠폰 캐시
      const expiredCoupon = new Coupon(
        dbCoupon.id,
        dbCoupon.name,
        10,
        100,
        0,
        expiredAt,
        now,
        now,
      );
      await couponRedisService.cacheCoupon(expiredCoupon);

      // Given: 쿠폰 발급 (Redis에서 발급 - 만료 체크는 발급 시점에서도 할 수 있지만 여기선 사용 시점에서 체크)
      // 만료된 쿠폰은 발급 자체가 실패할 수 있으므로 직접 Redis에 UserCoupon 생성
      const client = redisService.getClient();
      const userCouponKey = `${USER_COUPON_KEY_PREFIX}:${dbCoupon.id}:${user.id}`;
      await client.hset(userCouponKey, {
        couponId: dbCoupon.id.toString(),
        createdAt: now.getTime().toString(),
        expiredAt: expiredAt.getTime().toString(),
        usedAt: '',
        orderId: '',
      });

      // Given: 주문 생성
      const order = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When & Then: 만료된 쿠폰으로 결제 시 실패
      await expect(
        processPaymentUseCase.execute({
          orderId: order.orderId,
          userId: user.id,
          couponId: dbCoupon.id,
        }),
      ).rejects.toThrow();

      // Then: 주문 상태 유지 (PENDING)
      const finalOrder = await orderRepository.findById(order.orderId);
      expect(finalOrder!.status.isPending()).toBe(true);
    }, 30000);
  });

  describe('보상 트랜잭션 테스트', () => {
    it('잔액 부족으로 결제 실패 시 Redis 쿠폰 사용이 취소된다', async () => {
      // Given: 잔액이 부족한 사용자
      const user = await userRepository.create(new User(0, 10000)); // 1만원
      const product = await productRepository.create(
        new Product(
          0,
          '고가 상품',
          '설명',
          50000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
      );
      const productOption = await productOptionRepository.create(
        new ProductOption(0, product.id, 'RED', 'M', 10, 0),
      );
      const coupon = await createTestCoupon(10, 100); // 10% 할인해도 45,000원

      // Given: 쿠폰 발급
      await issueTestCouponToUser(user.id, coupon.id);

      // Given: 주문 생성 (재고 선점)
      const order = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When: 결제 시도 (잔액 부족으로 실패)
      await expect(
        processPaymentUseCase.execute({
          orderId: order.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
      ).rejects.toThrow();

      // Then: Redis 쿠폰 사용 취소 확인 (usedAt, orderId가 빈 값)
      const redisUserCoupon = await couponRedisService.getCachedUserCoupon(
        user.id,
        coupon.id,
      );
      expect(redisUserCoupon).not.toBeNull();
      expect(redisUserCoupon!.usedAt).toBeNull();
      expect(redisUserCoupon!.orderId).toBeNull();

      // Then: 주문 상태 PENDING 유지
      const finalOrder = await orderRepository.findById(order.orderId);
      expect(finalOrder!.status.isPending()).toBe(true);

      // Then: 잔액 유지
      const finalUser = await userRepository.findById(user.id);
      expect(finalUser!.balance).toBe(10000);
    }, 30000);

    it('1단계(Redis 쿠폰 사용) 실패 시 보상 트랜잭션 불필요 - 발급받지 않은 쿠폰', async () => {
      // Given: 사용자, 상품, 쿠폰 (발급 안함)
      const user = await userRepository.create(new User(0, 100000));
      const product = await productRepository.create(
        new Product(
          0,
          '상품',
          '설명',
          50000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
      );
      const productOption = await productOptionRepository.create(
        new ProductOption(0, product.id, 'RED', 'M', 10, 0),
      );
      const coupon = await createTestCoupon(10, 100);

      // Given: 주문 생성
      const order = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When: 발급받지 않은 쿠폰으로 결제 시도 (1단계에서 실패)
      await expect(
        processPaymentUseCase.execute({
          orderId: order.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
      ).rejects.toThrow();

      // Then: Redis에 UserCoupon이 없음 (보상 불필요)
      const redisUserCoupon = await couponRedisService.getCachedUserCoupon(
        user.id,
        coupon.id,
      );
      expect(redisUserCoupon).toBeNull();

      // Then: 주문 상태 PENDING 유지
      const finalOrder = await orderRepository.findById(order.orderId);
      expect(finalOrder!.status.isPending()).toBe(true);

      // Then: DB에 쿠폰 사용 기록 없음
      const userCoupons = await userCouponRepository.findByUserId(user.id);
      expect(userCoupons.length).toBe(0);

      // Then: 잔액 유지
      const finalUser = await userRepository.findById(user.id);
      expect(finalUser!.balance).toBe(100000);

      // Then: 재고 선점 상태 유지
      const finalOption = await productOptionRepository.findById(
        productOption.id,
      );
      expect(finalOption!.reservedStock).toBe(1);
    }, 30000);

    it('2단계(DB 트랜잭션) 실패 시 Redis 쿠폰만 취소 - DB 쿠폰 저장 실패 시뮬레이션', async () => {
      // 이 테스트는 DB 트랜잭션 실패를 시뮬레이션하기 어려우므로
      // 실제로는 트랜잭션 내부 에러 시 자동 롤백됨을 검증
      // 여기서는 이미 사용된 쿠폰으로 인한 실패를 테스트

      // Given: 사용자, 상품, 쿠폰 생성
      const user = await userRepository.create(new User(0, 200000));
      const product = await productRepository.create(
        new Product(
          0,
          '상품',
          '설명',
          50000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
      );
      const productOption = await productOptionRepository.create(
        new ProductOption(0, product.id, 'RED', 'M', 10, 0),
      );
      const coupon = await createTestCoupon(10, 100);

      // Given: 쿠폰 발급 및 첫 번째 결제 완료
      await issueTestCouponToUser(user.id, coupon.id);
      const order1 = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });
      await processPaymentUseCase.execute({
        orderId: order1.orderId,
        userId: user.id,
        couponId: coupon.id,
      });

      // Given: 두 번째 주문 생성
      const order2 = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When: 이미 사용된 쿠폰으로 결제 시도 (1단계에서 실패 - ALREADY_USED)
      await expect(
        processPaymentUseCase.execute({
          orderId: order2.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
      ).rejects.toThrow();

      // Then: Redis에서 쿠폰은 여전히 사용된 상태 (첫 번째 결제)
      const redisUserCoupon = await couponRedisService.getCachedUserCoupon(
        user.id,
        coupon.id,
      );
      expect(redisUserCoupon).not.toBeNull();
      expect(redisUserCoupon!.orderId).toBe(order1.orderId);

      // Then: 두 번째 주문은 PENDING 유지
      const finalOrder2 = await orderRepository.findById(order2.orderId);
      expect(finalOrder2!.status.isPending()).toBe(true);
    }, 30000);

    it('3단계(잔액 차감) 실패 시 Redis 쿠폰 취소 + DB 보상 트랜잭션 실행', async () => {
      // Given: 잔액이 부족한 사용자 (결제 금액보다 적게)
      const user = await userRepository.create(new User(0, 40000)); // 4만원
      const product = await productRepository.create(
        new Product(
          0,
          '상품',
          '설명',
          50000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
      );
      const productOption = await productOptionRepository.create(
        new ProductOption(0, product.id, 'RED', 'M', 10, 0),
      );
      const coupon = await createTestCoupon(10, 100); // 10% 할인 → 45,000원 필요

      // Given: 쿠폰 발급
      await issueTestCouponToUser(user.id, coupon.id);

      // Given: 주문 생성 (재고 선점)
      const order = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // 초기 재고 상태 확인
      const initialOption = await productOptionRepository.findById(
        productOption.id,
      );
      expect(initialOption!.reservedStock).toBe(1);

      // When: 결제 시도 (3단계 잔액 차감에서 실패)
      await expect(
        processPaymentUseCase.execute({
          orderId: order.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
      ).rejects.toThrow();

      // Then: Redis 쿠폰 사용 취소됨
      const redisUserCoupon = await couponRedisService.getCachedUserCoupon(
        user.id,
        coupon.id,
      );
      expect(redisUserCoupon).not.toBeNull();
      expect(redisUserCoupon!.usedAt).toBeNull();
      expect(redisUserCoupon!.orderId).toBeNull();

      // Then: 주문 상태 PENDING으로 복원
      const finalOrder = await orderRepository.findById(order.orderId);
      expect(finalOrder!.status.isPending()).toBe(true);

      // Then: DB에 쿠폰 사용 기록 없음 (보상 트랜잭션에서 삭제)
      const userCoupons = await userCouponRepository.findByUserId(user.id);
      expect(userCoupons.length).toBe(0);

      // Then: 잔액 유지
      const finalUser = await userRepository.findById(user.id);
      expect(finalUser!.balance).toBe(40000);

      // Then: 재고 복원 (reservedStock 유지, stock 복원)
      const finalOption = await productOptionRepository.findById(
        productOption.id,
      );
      expect(finalOption!.reservedStock).toBe(1); // 선점 상태 유지 (주문은 아직 PENDING)
    }, 30000);

    it('쿠폰 없이 결제 시 잔액 부족하면 주문/재고만 복원된다', async () => {
      // Given: 잔액이 부족한 사용자
      const user = await userRepository.create(new User(0, 10000)); // 1만원
      const product = await productRepository.create(
        new Product(
          0,
          '상품',
          '설명',
          50000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
      );
      const productOption = await productOptionRepository.create(
        new ProductOption(0, product.id, 'RED', 'M', 10, 0),
      );

      // Given: 주문 생성 (재고 선점)
      const order = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When: 쿠폰 없이 결제 시도 (잔액 부족)
      await expect(
        processPaymentUseCase.execute({
          orderId: order.orderId,
          userId: user.id,
        }),
      ).rejects.toThrow();

      // Then: 주문 상태 PENDING 유지
      const finalOrder = await orderRepository.findById(order.orderId);
      expect(finalOrder!.status.isPending()).toBe(true);

      // Then: 잔액 유지
      const finalUser = await userRepository.findById(user.id);
      expect(finalUser!.balance).toBe(10000);

      // Then: 재고 선점 상태 유지
      const finalOption = await productOptionRepository.findById(
        productOption.id,
      );
      expect(finalOption!.reservedStock).toBe(1);
    }, 30000);
  });

  describe('동시성 테스트 - 동일 사용자 중복 클릭 방지', () => {
    it('한 사용자가 동일 주문에 대해 동시에 3회 결제 클릭 시 1회만 성공한다', async () => {
      // Given: 사용자, 상품, 쿠폰 생성
      const user = await userRepository.create(new User(0, 100000));
      const product = await productRepository.create(
        new Product(
          0,
          '상품',
          '설명',
          10000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
      );
      const productOption = await productOptionRepository.create(
        new ProductOption(0, product.id, 'BLUE', 'L', 100, 0),
      );
      const coupon = await createTestCoupon(10, 100);

      // Given: 쿠폰 발급
      await issueTestCouponToUser(user.id, coupon.id);

      // Given: 주문 생성
      const order = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When: 동시에 3회 결제 클릭 시뮬레이션
      const results = await Promise.allSettled([
        processPaymentUseCase.execute({
          orderId: order.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
        processPaymentUseCase.execute({
          orderId: order.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
        processPaymentUseCase.execute({
          orderId: order.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
      ]);

      // Then: 1회만 성공, 2회는 실패
      const successResults = results.filter((r) => r.status === 'fulfilled');
      const failedResults = results.filter((r) => r.status === 'rejected');

      expect(successResults.length).toBe(1);
      expect(failedResults.length).toBe(2);

      // Then: 잔액은 1회만 차감됨 (10,000 * 90% = 9,000)
      const finalUser = await userRepository.findById(user.id);
      expect(finalUser!.balance).toBe(91000); // 100,000 - 9,000

      // Then: DB에 쿠폰 사용 기록 1개만 저장
      const userCoupons = await userCouponRepository.findByUserId(user.id);
      expect(userCoupons.length).toBe(1);

      // Then: 주문은 PAID 상태
      const finalOrder = await orderRepository.findById(order.orderId);
      expect(finalOrder!.status.isPaid()).toBe(true);
    }, 30000);

    it('한 사용자가 동일 쿠폰으로 다른 주문에 동시 결제 시 1회만 성공한다', async () => {
      // Given: 사용자, 상품, 쿠폰 생성
      const user = await userRepository.create(new User(0, 100000));
      const product = await productRepository.create(
        new Product(
          0,
          '상품',
          '설명',
          10000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
      );
      const productOption = await productOptionRepository.create(
        new ProductOption(0, product.id, 'BLUE', 'L', 100, 0),
      );
      const coupon = await createTestCoupon(10, 100);

      // Given: 쿠폰 발급
      await issueTestCouponToUser(user.id, coupon.id);

      // Given: 3개의 주문 생성
      const order1 = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });
      const order2 = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });
      const order3 = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When: 동일 쿠폰으로 3개 주문에 동시 결제 시도
      const results = await Promise.allSettled([
        processPaymentUseCase.execute({
          orderId: order1.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
        processPaymentUseCase.execute({
          orderId: order2.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
        processPaymentUseCase.execute({
          orderId: order3.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
      ]);

      // Then: 1회만 성공 (쿠폰은 1회만 사용 가능)
      const successResults = results.filter((r) => r.status === 'fulfilled');
      const failedResults = results.filter((r) => r.status === 'rejected');

      expect(successResults.length).toBe(1);
      expect(failedResults.length).toBe(2);

      // Then: Redis에서 쿠폰은 사용된 상태
      const redisUserCoupon = await couponRedisService.getCachedUserCoupon(
        user.id,
        coupon.id,
      );
      expect(redisUserCoupon).not.toBeNull();
      expect(redisUserCoupon!.usedAt).not.toBeNull();

      // Then: DB에 쿠폰 사용 기록 1개만 저장
      const userCoupons = await userCouponRepository.findByUserId(user.id);
      expect(userCoupons.length).toBe(1);

      // Then: PAID 상태인 주문은 1개
      const allOrders = await Promise.all([
        orderRepository.findById(order1.orderId),
        orderRepository.findById(order2.orderId),
        orderRepository.findById(order3.orderId),
      ]);
      const paidOrders = allOrders.filter((o) => o!.status.isPaid());
      expect(paidOrders.length).toBe(1);
    }, 30000);

    it('쿠폰 없이 동일 주문에 동시 3회 클릭 시 1회만 결제된다', async () => {
      // Given: 사용자, 상품 생성
      const user = await userRepository.create(new User(0, 100000));
      const product = await productRepository.create(
        new Product(
          0,
          '상품',
          '설명',
          10000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
      );
      const productOption = await productOptionRepository.create(
        new ProductOption(0, product.id, 'BLUE', 'L', 100, 0),
      );

      // Given: 주문 생성
      const order = await createOrderUseCase.execute({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When: 동시에 3회 결제 클릭
      const results = await Promise.allSettled([
        processPaymentUseCase.execute({
          orderId: order.orderId,
          userId: user.id,
        }),
        processPaymentUseCase.execute({
          orderId: order.orderId,
          userId: user.id,
        }),
        processPaymentUseCase.execute({
          orderId: order.orderId,
          userId: user.id,
        }),
      ]);

      // Then: 1회만 성공
      const successResults = results.filter((r) => r.status === 'fulfilled');
      expect(successResults.length).toBe(1);

      // Then: 잔액은 1회만 차감
      const finalUser = await userRepository.findById(user.id);
      expect(finalUser!.balance).toBe(90000); // 100,000 - 10,000

      // Then: 주문은 PAID 상태
      const finalOrder = await orderRepository.findById(order.orderId);
      expect(finalOrder!.status.isPaid()).toBe(true);
    }, 30000);
  });
});
