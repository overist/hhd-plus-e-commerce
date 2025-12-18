import { Test, TestingModule } from '@nestjs/testing';
import { GlobalKafkaModule } from '@common/kafka/kafka.module';
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
  ProductSalesRankingRepository,
} from '@/product/infrastructure/product.repository';
import {
  UserRepository,
  UserBalanceChangeLogRepository,
} from '@/user/infrastructure/user.repository';
import {
  CouponRepository,
  UserCouponRepository,
} from '@/coupon/infrastructure/coupon.repository';
import {
  IOrderRepository,
  IOrderItemRepository,
} from '@/order/domain/interfaces/order.repository.interface';
import {
  IProductRepository,
  IProductOptionRepository,
  IProductSalesRankingRepository,
} from '@/product/domain/interfaces/product.repository.interface';
import {
  IUserRepository,
  IUserBalanceChangeLogRepository,
} from '@/user/domain/interfaces/user.repository.interface';
import {
  ICouponRepository,
  IUserCouponRepository,
} from '@/coupon/domain/interfaces/coupon.repository.interface';
import { Product } from '@/product/domain/entities/product.entity';
import { ProductOption } from '@/product/domain/entities/product-option.entity';
import { User } from '@/user/domain/entities/user.entity';
import { Coupon } from '@/coupon/domain/entities/coupon.entity';
import { UserCoupon } from '@/coupon/domain/entities/user-coupon.entity';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import { RedisService } from '@common/redis/redis.service';
import { RedisLockService } from '@common/redis-lock-manager/redis.lock.service';

import {
  setupDatabaseTest,
  setupRedisForTest,
  setupKafkaForTest,
  getRedisService,
  getRedisLockService,
  cleanupDatabase,
  teardownIntegrationTest,
  createTopicIfNotExists,
} from '../setup';

import { waitForCondition } from '../helpers/wait-for';
import { OrderKafkaProducer } from '@/order/infrastructure/order.kafka.producer';
import { OrderProcessingStateStore } from '@/order/infrastructure/order-processing-state.store';
import { OrderProcessingInitKafkaConsumer } from '@/order/presentation/consumers/order-processing-init.kafka.consumer';
import { OrderProcessingStockSuccessKafkaConsumer } from '@/order/presentation/consumers/order-processing-stock-success.kafka.consumer';
import { OrderProcessingCouponSuccessKafkaConsumer } from '@/order/presentation/consumers/order-processing-coupon-success.kafka.consumer';
import { OrderProcessingSuccessKafkaConsumer } from '@/order/presentation/consumers/order-processing-success.kafka.consumer';
import { OrderProcessingFailKafkaConsumer } from '@/order/presentation/consumers/order-processing-fail.kafka.consumer';
import { OrderPaymentSuccessKafkaConsumer } from '@/order/presentation/consumers/order-payment-success.kafka.consumer';
import { OrderPaymentFailKafkaConsumer } from '@/order/presentation/consumers/order-payment-fail.kafka.consumer';
import { ExternalPlatformKafkaConsumer } from '@/order/presentation/consumers/external-platform.kafka.consumer';
import { ProductKafkaProducer } from '@/product/infrastructure/product.kafka.producer';
import { ProductOrderProcessingKafkaConsumer } from '@/product/presentation/consumers/order-processing.kafka.consumer';
import { ProductOrderProcessingFailKafkaConsumer } from '@/product/presentation/consumers/order-processing-fail.kafka.consumer';
import { ProductOrderProcessedKafkaConsumer } from '@/product/presentation/consumers/order-processed.kafka.consumer';
import { ProductOrderPaymentFailKafkaConsumer } from '@/product/presentation/consumers/order-payment-fail.kafka.consumer';
import { CouponKafkaProducer } from '@/coupon/infrastructure/coupon.kafka.producer';
import { CouponOrderProcessingKafkaConsumer } from '@/coupon/presentation/consumers/order-processing.kafka.consumer';
import { CouponOrderProcessingFailKafkaConsumer } from '@/coupon/presentation/consumers/order-processing-fail.kafka.consumer';
import { CouponOrderPaymentFailKafkaConsumer } from '@/coupon/presentation/consumers/order-payment-fail.kafka.consumer';
import { UserKafkaProducer } from '@/user/infrastructure/user.kafka.producer';
import { UserOrderPaymentKafkaConsumer } from '@/user/presentation/consumers/order-payment.kafka.consumer';

describe('결제 처리 - Redis 쿠폰 활용 통합 테스트', () => {
  let module: TestingModule;
  let prismaService: PrismaService;
  let redisService: RedisService;
  let redisLockService: RedisLockService;
  let createOrderUseCase: CreateOrderUseCase;
  let processPaymentUseCase: ProcessPaymentUseCase;
  let orderRepository: OrderRepository;
  let productRepository: ProductRepository;
  let productOptionRepository: ProductOptionRepository;
  let userRepository: UserRepository;
  let userCouponRepository: UserCouponRepository;
  let couponRedisService: CouponRedisService;

  beforeAll(async () => {
    prismaService = await setupDatabaseTest();
    await setupRedisForTest();
    await setupKafkaForTest();
    redisService = getRedisService();
    redisLockService = getRedisLockService();

    const TOPIC_ORDER_PROCESSING = 'order.processing';
    const TOPIC_ORDER_PROCESSING_SUCCESS = 'order.processing.success';
    const TOPIC_ORDER_PROCESSING_FAIL = 'order.processing.fail';
    const TOPIC_ORDER_PROCESSING_FAIL_DONE = 'order.processing.fail.done';

    const TOPIC_ORDER_PAYMENT = 'order.payment';
    const TOPIC_ORDER_PAYMENT_SUCCESS = 'order.payment.success';
    const TOPIC_ORDER_PAYMENT_FAIL = 'order.payment.fail';
    const TOPIC_ORDER_PAYMENT_FAIL_DONE = 'order.payment.fail.done';

    const TOPIC_ORDER_PROCESSED = 'order.processed';
    const TOPIC_ORDER_PROCESSING_STOCK_SUCCESS =
      'order.processing.stock.success';
    const TOPIC_ORDER_PROCESSING_COUPON_SUCCESS =
      'order.processing.coupon.success';

    await createTopicIfNotExists(TOPIC_ORDER_PROCESSING);
    await createTopicIfNotExists(TOPIC_ORDER_PROCESSING_SUCCESS);
    await createTopicIfNotExists(TOPIC_ORDER_PROCESSING_FAIL);
    await createTopicIfNotExists(TOPIC_ORDER_PROCESSING_FAIL_DONE);
    await createTopicIfNotExists(TOPIC_ORDER_PAYMENT);
    await createTopicIfNotExists(TOPIC_ORDER_PAYMENT_SUCCESS);
    await createTopicIfNotExists(TOPIC_ORDER_PAYMENT_FAIL);
    await createTopicIfNotExists(TOPIC_ORDER_PAYMENT_FAIL_DONE);
    await createTopicIfNotExists(TOPIC_ORDER_PROCESSED);
    await createTopicIfNotExists(TOPIC_ORDER_PROCESSING_STOCK_SUCCESS);
    await createTopicIfNotExists(TOPIC_ORDER_PROCESSING_COUPON_SUCCESS);

    // NestJS Test Module 생성 (이벤트 리스너 포함)
    module = await Test.createTestingModule({
      imports: [GlobalKafkaModule],
      providers: [
        // Prisma & Redis
        { provide: PrismaService, useValue: prismaService },
        { provide: RedisService, useValue: redisService },
        { provide: RedisLockService, useValue: redisLockService },

        // Order
        OrderRepository,
        { provide: IOrderRepository, useClass: OrderRepository },
        OrderItemRepository,
        { provide: IOrderItemRepository, useClass: OrderItemRepository },
        OrderDomainService,

        // Product
        ProductRepository,
        { provide: IProductRepository, useClass: ProductRepository },
        ProductOptionRepository,
        {
          provide: IProductOptionRepository,
          useClass: ProductOptionRepository,
        },
        ProductSalesRankingRepository,
        {
          provide: IProductSalesRankingRepository,
          useClass: ProductSalesRankingRepository,
        },
        ProductDomainService,

        // User
        UserRepository,
        { provide: IUserRepository, useClass: UserRepository },
        UserBalanceChangeLogRepository,
        {
          provide: IUserBalanceChangeLogRepository,
          useClass: UserBalanceChangeLogRepository,
        },
        UserDomainService,

        // Coupon
        CouponRepository,
        { provide: ICouponRepository, useClass: CouponRepository },
        UserCouponRepository,
        { provide: IUserCouponRepository, useClass: UserCouponRepository },
        CouponDomainService,
        CouponRedisService,

        // Use Cases
        CreateOrderUseCase,
        ProcessPaymentUseCase,

        // Kafka Producers / Consumers
        OrderKafkaProducer,
        OrderProcessingStateStore,
        OrderProcessingInitKafkaConsumer,
        OrderProcessingStockSuccessKafkaConsumer,
        OrderProcessingCouponSuccessKafkaConsumer,
        OrderProcessingSuccessKafkaConsumer,
        OrderProcessingFailKafkaConsumer,
        OrderPaymentSuccessKafkaConsumer,
        OrderPaymentFailKafkaConsumer,
        ExternalPlatformKafkaConsumer,
        ProductKafkaProducer,
        ProductOrderProcessingKafkaConsumer,
        ProductOrderProcessingFailKafkaConsumer,
        ProductOrderProcessedKafkaConsumer,
        ProductOrderPaymentFailKafkaConsumer,
        CouponKafkaProducer,
        CouponOrderProcessingKafkaConsumer,
        CouponOrderProcessingFailKafkaConsumer,
        CouponOrderPaymentFailKafkaConsumer,
        UserKafkaProducer,
        UserOrderPaymentKafkaConsumer,
      ],
    }).compile();

    // 모듈 초기화 (이벤트 리스너 활성화)
    await module.init();

    createOrderUseCase = module.get(CreateOrderUseCase);
    processPaymentUseCase = module.get(ProcessPaymentUseCase);
    orderRepository = module.get(OrderRepository);
    productRepository = module.get(ProductRepository);
    productOptionRepository = module.get(ProductOptionRepository);
    userRepository = module.get(UserRepository);
    userCouponRepository = module.get(UserCouponRepository);
    couponRedisService = module.get(CouponRedisService);
  }, 120000);

  afterAll(async () => {
    await module?.close();
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

  /**
   * 테스트용 Redis 쿠폰 조회 헬퍼 (null-safe)
   */
  async function getRedisUserCouponOrNull(
    userId: number,
    couponId: number,
  ): Promise<UserCoupon | null> {
    try {
      return await couponRedisService.getCachedUserCoupon(userId, couponId);
    } catch {
      return null;
    }
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
      const order = await createOrderUseCase.createOrder({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When: 쿠폰을 사용하여 결제
      await processPaymentUseCase.processPayment({
        orderId: order.orderId,
        userId: user.id,
        couponId: coupon.id,
      });
      await waitForCondition(async () => {
        const targetOrder = await orderRepository.findById(order.orderId);
        return targetOrder?.status.isPaid() ?? false;
      });

      // Then: 할인이 적용된 금액으로 결제됨 (50,000 * 10% = 5,000 할인)
      const finalOrder = await orderRepository.findById(order.orderId);
      expect(finalOrder!.finalAmount).toBe(45000);
      expect(finalOrder!.paidAt).not.toBeNull();

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
      const order = await createOrderUseCase.createOrder({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 2 }],
      });

      // When: 쿠폰 없이 결제
      await processPaymentUseCase.processPayment({
        orderId: order.orderId,
        userId: user.id,
      });

      await waitForCondition(async () => {
        const targetOrder = await orderRepository.findById(order.orderId);
        return targetOrder?.status.isPaid() ?? false;
      });

      // Then: 정가로 결제됨
      const finalOrder = await orderRepository.findById(order.orderId);
      expect(finalOrder!.finalAmount).toBe(60000); // 30,000 * 2
      const finalUser = await userRepository.findById(user.id);
      expect(finalUser!.balance).toBe(40000); // 100,000 - 60,000
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
      const order = await createOrderUseCase.createOrder({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When & Then: 발급받지 않은 쿠폰으로 결제 시 실패
      await processPaymentUseCase.processPayment({
        orderId: order.orderId,
        userId: user.id,
        couponId: coupon.id,
      });

      await waitForCondition(async () => {
        const targetOrder = await orderRepository.findById(order.orderId);
        return targetOrder?.status.isPending() ?? false;
      });

      // Then: 잔액 유지
      const finalUser = await userRepository.findById(user.id);
      expect(finalUser!.balance).toBe(100000);
    }, 30000);

    it('잔액이 부족하면 결제 실패하고 쿠폰이 롤백된다', async () => {
      // Given: 잔액이 부족한 사용자
      const user = await userRepository.create(new User(0, 10000)); // 10,000원만 보유
      const product = await productRepository.create(
        new Product(
          0,
          '비싼 상품',
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

      // Given: 주문 생성
      const order = await createOrderUseCase.createOrder({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When & Then: 잔액 부족으로 결제 실패
      await processPaymentUseCase.processPayment({
        orderId: order.orderId,
        userId: user.id,
        couponId: coupon.id,
      });

      await waitForCondition(async () => {
        const targetOrder = await orderRepository.findById(order.orderId);
        return targetOrder?.status.isPending() ?? false;
      });

      // Then: 잔액 유지
      const finalUser = await userRepository.findById(user.id);
      expect(finalUser!.balance).toBe(10000);

      // Then: Redis에서 쿠폰 사용 취소됨 (보상 트랜잭션)
      const redisUserCoupon = await getRedisUserCouponOrNull(
        user.id,
        coupon.id,
      );
      expect(redisUserCoupon!.usedAt).toBeNull();
      expect(redisUserCoupon!.orderId).toBeNull();
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
      const order1 = await createOrderUseCase.createOrder({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      await processPaymentUseCase.processPayment({
        orderId: order1.orderId,
        userId: user.id,
        couponId: coupon.id,
      });

      await waitForCondition(async () => {
        const targetOrder = await orderRepository.findById(order1.orderId);
        return targetOrder?.status.isPaid() ?? false;
      });

      // Given: 두 번째 주문 생성
      const order2 = await createOrderUseCase.createOrder({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When & Then: 이미 사용된 쿠폰으로 결제 시 실패
      await processPaymentUseCase.processPayment({
        orderId: order2.orderId,
        userId: user.id,
        couponId: coupon.id,
      });

      await waitForCondition(async () => {
        const targetOrder = await orderRepository.findById(order2.orderId);
        return targetOrder?.status.isPending() ?? false;
      });
      await waitForCondition(async () => {
        const targetCoupon = await userCouponRepository.findByUserId(user.id);
        return targetCoupon.length > 0 && targetCoupon[0].usedAt !== null;
      });
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
      const order = await createOrderUseCase.createOrder({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When: 동시에 3회 결제 클릭 시뮬레이션
      const results = await Promise.allSettled([
        processPaymentUseCase.processPayment({
          orderId: order.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
        processPaymentUseCase.processPayment({
          orderId: order.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
        processPaymentUseCase.processPayment({
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

      await waitForCondition(async () => {
        const targetOrder = await orderRepository.findById(order.orderId);
        return targetOrder?.status.isPaid() ?? false;
      });

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
      const order1 = await createOrderUseCase.createOrder({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });
      const order2 = await createOrderUseCase.createOrder({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });
      const order3 = await createOrderUseCase.createOrder({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      const orderIds = [order1.orderId, order2.orderId, order3.orderId];
      const orderIdSet = new Set(orderIds);

      // When: 동일 쿠폰으로 3개 주문에 동시 결제 시도
      const results = await Promise.allSettled([
        processPaymentUseCase.processPayment({
          orderId: order1.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
        processPaymentUseCase.processPayment({
          orderId: order2.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
        processPaymentUseCase.processPayment({
          orderId: order3.orderId,
          userId: user.id,
          couponId: coupon.id,
        }),
      ]);

      await waitForCondition(async () => {
        const userCoupons = await userCouponRepository.findByUserId(user.id);
        return (
          userCoupons.length === 1 && orderIdSet.has(userCoupons[0].orderId!)
        );
      });

      // Then: 요청은 모두 접수되지만, 쿠폰은 1회만 사용 가능하므로 결과는 1건만 성공
      const successResults = results.filter((r) => r.status === 'fulfilled');
      const failedResults = results.filter((r) => r.status === 'rejected');

      expect(successResults.length).toBe(3);
      expect(failedResults.length).toBe(0);

      // Then: Redis에서 쿠폰은 사용된 상태
      const redisUserCoupon = await getRedisUserCouponOrNull(
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
      const order = await createOrderUseCase.createOrder({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // When: 동시에 3회 결제 클릭
      const results = await Promise.allSettled([
        processPaymentUseCase.processPayment({
          orderId: order.orderId,
          userId: user.id,
        }),
        processPaymentUseCase.processPayment({
          orderId: order.orderId,
          userId: user.id,
        }),
        processPaymentUseCase.processPayment({
          orderId: order.orderId,
          userId: user.id,
        }),
      ]);

      // Then: 1회만 성공
      const successResults = results.filter((r) => r.status === 'fulfilled');
      expect(successResults.length).toBe(1);

      await waitForCondition(async () => {
        const targetOrder = await orderRepository.findById(order.orderId);
        return targetOrder?.status.isPaid() ?? false;
      });

      // Then: 잔액은 1회만 차감
      const finalUser = await userRepository.findById(user.id);
      expect(finalUser!.balance).toBe(90000); // 100,000 - 10,000

      // Then: 주문은 PAID 상태
      const finalOrder = await orderRepository.findById(order.orderId);
      expect(finalOrder!.status.isPaid()).toBe(true);
    }, 30000);
  });
});
