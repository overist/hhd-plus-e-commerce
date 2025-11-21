import { OrderExpirationScheduler } from '@infrastructure/schedulers/order-expiration.scheduler';
import {
  OrderRepository,
  OrderItemRepository,
  ProductRepository,
  ProductOptionRepository,
  UserRepository,
} from '@infrastructure/repositories/prisma';
import { Order } from '@domain/order/order.entity';
import { OrderItem } from '@domain/order/order-item.entity';
import { Product } from '@domain/product/product.entity';
import { ProductOption } from '@domain/product/product-option.entity';
import { User } from '@domain/user/user.entity';
import { OrderStatus } from '@domain/order/order-status.vo';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import {
  setupIntegrationTest,
  cleanupDatabase,
  teardownIntegrationTest,
} from './setup';

describe('OrderExpirationScheduler Integration Tests', () => {
  let prismaService: PrismaService;
  let scheduler: OrderExpirationScheduler;
  let orderRepository: OrderRepository;
  let orderItemRepository: OrderItemRepository;
  let productRepository: ProductRepository;
  let productOptionRepository: ProductOptionRepository;
  let userRepository: UserRepository;

  beforeAll(async () => {
    prismaService = await setupIntegrationTest();
  }, 60000); // 60초 타임아웃

  afterAll(async () => {
    await teardownIntegrationTest();
  }, 60000); // 60초 타임아웃

  beforeEach(async () => {
    await cleanupDatabase(prismaService);

    orderRepository = new OrderRepository(prismaService);
    orderItemRepository = new OrderItemRepository(prismaService);
    productRepository = new ProductRepository(prismaService);
    productOptionRepository = new ProductOptionRepository(prismaService);
    userRepository = new UserRepository(prismaService);

    scheduler = new OrderExpirationScheduler(
      orderRepository,
      orderItemRepository,
      productOptionRepository,
    );
  });

  describe('10분 만료 재고 해제', () => {
    it('10분 경과한 PENDING 주문의 재고가 자동 해제된다', async () => {
      // Given: 10분 전에 생성된 주문
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
        new ProductOption(0, product.id, 'RED', 'M', 100, 0),
      );

      // 재고 선점
      productOption.reserveStock(10);
      await productOptionRepository.update(productOption);

      // 11분 전 주문 생성 (만료됨)
      const pastTime = new Date(Date.now() - 11 * 60 * 1000);
      const expiredTime = new Date(pastTime.getTime() + 10 * 60 * 1000);
      const order = await orderRepository.create(
        new Order(
          0,
          user.id,
          null,
          10000,
          0,
          10000,
          OrderStatus.PENDING,
          pastTime,
          null,
          expiredTime,
          pastTime,
        ),
      );

      await orderItemRepository.create(
        new OrderItem(
          0,
          order.id,
          productOption.id,
          '상품',
          10000,
          10,
          100000,
          new Date(),
        ),
      );

      // When: 스케줄러 실행
      await scheduler.releaseExpiredOrders();

      // Then: 주문 상태 EXPIRED, 재고 복원
      const updatedOrder = await orderRepository.findById(order.id);
      expect(updatedOrder!.status.isExpired()).toBe(true);

      const updatedOption = await productOptionRepository.findById(
        productOption.id,
      );
      expect(updatedOption!.stock).toBe(100); // 복원됨
      expect(updatedOption!.reservedStock).toBe(0); // 선점 해제됨
    });
  });
});
