import { OrderFacade } from '@/order/application/order.facade';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import { UserDomainService } from '@/user/domain/services/user.service';
import {
  OrderPrismaRepository,
  OrderItemRepository,
} from '@/order/infrastructure/order.prisma.repository';
import {
  ProductPrismaRepository,
  ProductOptionRepository,
} from '@/product/infrastructure/product.prisma.repository';
import {
  UserPrismaRepository,
  UserBalanceChangeLogRepository,
} from '@/user/infrastructure/user.prisma.repository';
import {
  CouponPrismaRepository,
  UserCouponRepository,
} from '@/coupon/infrastructure/coupon.prisma.repository';
import { Product } from '@/product/domain/entities/product.entity';
import { ProductOption } from '@/product/domain/entities/product-option.entity';
import { User } from '@/user/domain/entities/user.entity';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import {
  setupIntegrationTest,
  cleanupDatabase,
  teardownIntegrationTest,
} from './setup';

describe('결제 처리 통합 테스트 (US-009)', () => {
  let prismaService: PrismaService;
  let orderFacade: OrderFacade;
  let orderRepository: OrderPrismaRepository;
  let productRepository: ProductPrismaRepository;
  let productOptionRepository: ProductOptionRepository;
  let userRepository: UserPrismaRepository;

  beforeAll(async () => {
    prismaService = await setupIntegrationTest();
  }, 60000); // 60초 타임아웃

  afterAll(async () => {
    await teardownIntegrationTest();
  }, 60000); // 60초 타임아웃

  beforeEach(async () => {
    await cleanupDatabase(prismaService);

    orderRepository = new OrderPrismaRepository(prismaService);
    const orderItemRepository = new OrderItemRepository(prismaService);
    productRepository = new ProductPrismaRepository(prismaService);
    productOptionRepository = new ProductOptionRepository(prismaService);
    userRepository = new UserPrismaRepository(prismaService);
    const balanceLogRepository = new UserBalanceChangeLogRepository(
      prismaService,
    );
    const couponRepository = new CouponPrismaRepository(prismaService);
    const userCouponRepository = new UserCouponRepository(prismaService);
    const productPopularitySnapshotRepository = new (class {
      async findAll() {
        return [];
      }
      async create() {
        return null;
      }
    })();

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
    const userService = new UserDomainService(
      userRepository,
      balanceLogRepository,
    );

    orderFacade = new OrderFacade(
      orderService,
      productService,
      couponService,
      userService,
      prismaService,
    );
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
          orderFacade.createOrder(user.id, [
            { productOptionId: productOption.id, quantity: 10 },
          ]),
        ),
      );

      // When: 3명이 동시에 결제 (잔액 차감 + 재고 확정)
      await Promise.all(
        orders.map((order, idx) =>
          orderFacade.processPayment(order.orderId, users[idx].id),
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
      const order = await orderFacade.createOrder(user.id, [
        { productOptionId: productOption.id, quantity: 1 },
      ]);

      // Given: 잔액을 부족하게 만듦 (다른 주문으로 소진)
      const userForDeduct = await userRepository.findById(user.id);
      userForDeduct!.deduct(90000, 999, '테스트 차감');
      await userRepository.update(userForDeduct!);

      // When: 결제 시도 (잔액 부족으로 실패)
      await expect(
        orderFacade.processPayment(order.orderId, user.id),
      ).rejects.toThrow();

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
