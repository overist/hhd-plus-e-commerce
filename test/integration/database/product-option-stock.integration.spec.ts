import { CreateOrderUseCase } from '@/order/application/create-order.use-case';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
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
import { PrismaService } from '@common/prisma-manager/prisma.service';
import {
  setupDatabaseTest,
  cleanupDatabase,
  teardownIntegrationTest,
} from '../setup';

describe('동시성 제어 통합 테스트', () => {
  let prismaService: PrismaService;
  let createOrderUseCase: CreateOrderUseCase;
  let productRepository: ProductRepository;
  let productOptionRepository: ProductOptionRepository;
  let userRepository: UserRepository;

  beforeAll(async () => {
    prismaService = await setupDatabaseTest();
  }, 60000); // 60초 타임아웃

  afterAll(async () => {
    await teardownIntegrationTest();
  }, 60000); // 60초 타임아웃

  beforeEach(async () => {
    await cleanupDatabase(prismaService);

    const orderRepository = new OrderRepository(prismaService);
    const orderItemRepository = new OrderItemRepository(prismaService);
    productRepository = new ProductRepository(prismaService);
    productOptionRepository = new ProductOptionRepository(prismaService);
    userRepository = new UserRepository(prismaService);
    const balanceLogRepository = new UserBalanceChangeLogRepository(
      prismaService,
    );
    const couponRepository = new CouponRepository(prismaService);
    const userCouponRepository = new UserCouponRepository(prismaService);
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

    const orderService = new OrderDomainService(
      orderRepository,
      orderItemRepository,
    );
    const productService = new ProductDomainService(
      productRepository,
      productOptionRepository,
      productPopularitySnapshotRepository as any,
    );
    const userService = new UserDomainService(
      userRepository,
      balanceLogRepository,
      prismaService,
    );

    createOrderUseCase = new CreateOrderUseCase(
      orderService,
      productService,
      userService,
      prismaService,
    );
  });

  describe('product-option.stock 동시성', () => {
    it('동시에 10명이 같은 상품 주문 시 재고가 정확히 차감된다', async () => {
      // Given: 재고 100개
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
        new ProductOption(0, product.id, 'RED', 'M', 100, 0),
      );

      const users = await Promise.all(
        Array.from(
          { length: 10 },
          () => userRepository.create(new User(0, 1000000)), // version은 기본값 1
        ),
      );

      // When: 10명이 각각 10개씩 동시 주문
      await Promise.all(
        users.map((user) =>
          createOrderUseCase.execute({
            userId: user.id,
            items: [{ productOptionId: productOption.id, quantity: 10 }],
          }),
        ),
      );

      // Then: 재고 정확히 100 -> 0
      const finalOption = await productOptionRepository.findById(
        productOption.id,
      );
      expect(finalOption!.reservedStock).toBe(100);
      expect(finalOption!.availableStock).toBe(0);
    }, 30000); // 30초 타임아웃 (10명 동시 주문)
  });
});
