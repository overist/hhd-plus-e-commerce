import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
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

// Event Listeners
import { OnOrderProcessingListener as CouponOnOrderProcessingListener } from '@/coupon/application/listeners/on-order-processing.listener';
import { OnOrderProcessingListener as ProductOnOrderProcessingListener } from '@/product/application/listeners/on-order-processing.listener';
import { OnOrderPaymentListener } from '@/user/application/listeners/on-order-payment.listener';
import { OnOrderProcessingFailListener } from '@/coupon/application/listeners/on-order-fail.listener';
import { OnOrderFailListener as ProductOnOrderFailListener } from '@/product/application/listeners/on-order-fail.listener';
import { OnOrderFailListener as OrderOnOrderFailListener } from '@/order/application/listeners/on-order-fail.listener';
import { OnOrderProcessingListener as OrderOnOrderProcessingListener } from '@/order/application/listeners/on-order-processing.listener';
import { OnOrderProcessingSuccessListener } from '@/order/application/listeners/on-order-processing-success.listener';
import { OnOrderPaymentSuccessListener } from '@/order/application/listeners/on-order-payment-success.listener';

import {
  setupDatabaseTest,
  setupRedisForTest,
  getRedisService,
  getRedisLockService,
  cleanupDatabase,
  teardownIntegrationTest,
} from '../setup';

import { awaitEvent } from '../helpers/await-event';
import { OrderProcessedEvent } from '@/order/application/events/order-processed.event';
import { OrderPaymentFailDoneEvent } from '@/order/application/events/order-payment-fail-done.event';

describe('결제 처리 통합 테스트 (US-009)', () => {
  let module: TestingModule;
  let eventEmitter: EventEmitter2;
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
    redisService = getRedisService();
    redisLockService = getRedisLockService();

    // NestJS Test Module 생성 (이벤트 리스너 포함)
    module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
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

        // Event Listeners (보상 트랜잭션 포함)
        CouponOnOrderProcessingListener,
        ProductOnOrderProcessingListener,
        OrderOnOrderProcessingListener,
        OnOrderPaymentListener,
        OnOrderProcessingSuccessListener,
        OnOrderPaymentSuccessListener,
        OnOrderProcessingFailListener,
        ProductOnOrderFailListener,
        OrderOnOrderFailListener,
      ],
    }).compile();

    // 모듈 초기화 (이벤트 리스너 활성화)
    await module.init();

    eventEmitter = module.get(EventEmitter2);

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
      const processedEvents = orders.map((order) =>
        awaitEvent<OrderProcessedEvent>(
          eventEmitter,
          OrderProcessedEvent.EVENT_NAME,
          {
            timeoutMs: 20000,
            filter: (payload) => payload.orderId === order.orderId,
          },
        ),
      );

      await Promise.all(
        orders.map((order, idx) =>
          processPaymentUseCase.processPayment({
            orderId: order.orderId,
            userId: users[idx].id,
          }),
        ),
      );

      await Promise.all(processedEvents);

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
      const failDoneByOrder = awaitEvent<OrderPaymentFailDoneEvent>(
        eventEmitter,
        OrderPaymentFailDoneEvent.EVENT_NAME,
        {
          timeoutMs: 20000,
          filter: (payload) =>
            payload.orderId === order.orderId &&
            payload.handlerName === 'order',
        },
      );
      const failDoneByProduct = awaitEvent<OrderPaymentFailDoneEvent>(
        eventEmitter,
        OrderPaymentFailDoneEvent.EVENT_NAME,
        {
          timeoutMs: 20000,
          filter: (payload) =>
            payload.orderId === order.orderId &&
            payload.handlerName === 'product',
        },
      );

      await processPaymentUseCase.processPayment({
        orderId: order.orderId,
        userId: user.id,
      });

      await Promise.all([failDoneByOrder, failDoneByProduct]);

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
    }, 30000); // 30초 타임아웃
  });
});
