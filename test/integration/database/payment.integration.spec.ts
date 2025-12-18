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
import {
  OrderKafkaProducer,
  OrderFailDoneMessage,
} from '@/order/infrastructure/order.kafka.producer';
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

describe('결제 처리 통합 테스트 (US-009)', () => {
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

  describe('결제 처리 동시성', () => {
    it('동시에 여러 주문 결제 시 잔액과 재고가 정확히 처리된다', async () => {
      // Given: 3명의 사용자, 각 잔액 500,000원
      const users = await Promise.all(
        Array.from({ length: 3 }, () =>
          userRepository.create(new User(0, 500000)),
        ),
      );

      const product = await productRepository.create(
        new Product(
          0,
          '상품',
          '설명',
          20000,
          '의류',
          true,
          new Date(),
          new Date(),
        ),
      );

      const productOption = await productOptionRepository.create(
        new ProductOption(0, product.id, 'BLUE', 'L', 100, 0),
      );

      // When: 3명이 각각 주문 생성 (재고 선점)
      const orders = await Promise.all(
        users.map((user) =>
          createOrderUseCase.createOrder({
            userId: user.id,
            items: [{ productOptionId: productOption.id, quantity: 10 }],
          }),
        ),
      );

      // When: 3명이 동시에 결제 (잔액 차감 + 재고 확정)
      await Promise.all(
        orders.map((order, idx) =>
          processPaymentUseCase.processPayment({
            orderId: order.orderId,
            userId: users[idx].id,
          }),
        ),
      );

      await Promise.all(
        orders.map((order) =>
          waitForCondition(
            async () => {
              const targetOrder = await orderRepository.findById(order.orderId);
              return targetOrder?.status.isPaid() ?? false;
            },
            { timeoutMs: 20000 },
          ),
        ),
      );

      // Then: 잔액 정확히 차감 (500,000 - 200,000 = 300,000)
      for (const user of users) {
        const updatedUser = await userRepository.findById(user.id);
        expect(updatedUser!.balance).toBe(300000);
      }

      // Then: 재고 정확히 확정 차감 (100 - 30 = 70)
      const finalOption = await productOptionRepository.findById(
        productOption.id,
      );
      expect(finalOption!.stock).toBe(70);
      expect(finalOption!.reservedStock).toBe(0);
    }, 30000); // 30초 타임아웃

    it('결제 실패 시 잔액은 차감되지 않고 재고는 선점 상태로 유지된다', async () => {
      // Given: 충분한 잔액으로 주문 생성
      const user = await userRepository.create(new User(0, 100000));

      const product = await productRepository.create(
        new Product(
          0,
          '고가 상품',
          '설명',
          50000,
          '전자제품',
          true,
          new Date(),
          new Date(),
        ),
      );

      const productOption = await productOptionRepository.create(
        new ProductOption(0, product.id, 'BLACK', 'XL', 10, 0),
      );

      // When: 주문 생성 (재고 선점 성공)
      const order = await createOrderUseCase.createOrder({
        userId: user.id,
        items: [{ productOptionId: productOption.id, quantity: 1 }],
      });

      // Given: 잔액을 부족하게 만듦 (다른 주문으로 소진)
      const userForDeduct = await userRepository.findById(user.id);
      userForDeduct!.deduct(90000, 999, '테스트 차감');
      await userRepository.update(userForDeduct!);

      // When: 결제 요청 (즉시 접수)
      await processPaymentUseCase.processPayment({
        orderId: order.orderId,
        userId: user.id,
      });

      await waitForCondition(async () => {
        const targetOrder = await orderRepository.findById(order.orderId);
        return targetOrder?.status.isPending() ?? false;
      });

      // Then: 잔액은 10,000원 유지
      const finalUser = await userRepository.findById(user.id);
      expect(finalUser!.balance).toBe(10000);

      // Then: 재고는 선점 상태 유지 (결제 실패했으므로 확정 차감 안됨)
      const finalOption = await productOptionRepository.findById(
        productOption.id,
      );
      expect(finalOption!.reservedStock).toBe(1); // 선점 상태 유지

      // Then: 주문 상태는 PENDING 유지
      const finalOrder = await orderRepository.findById(order.orderId);
      expect(finalOrder!.status.isPending()).toBe(true);
    }, 60000); // 60초 타임아웃으로 증가
  });
});
