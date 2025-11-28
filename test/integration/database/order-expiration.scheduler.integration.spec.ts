import { OrderExpirationScheduler } from '@/@schedulers/order-expiration.scheduler';
import {
  ProductPrismaRepository,
  ProductOptionRepository,
} from '@/product/infrastructure/product.prisma.repository';
import { UserPrismaRepository } from '@/user/infrastructure/user.prisma.repository';
import {
  OrderPrismaRepository,
  OrderItemRepository,
} from '@/order/infrastructure/order.prisma.repository';
import { Order } from '@/order/domain/entities/order.entity';
import { OrderItem } from '@/order/domain/entities/order-item.entity';
import { Product } from '@/product/domain/entities/product.entity';
import { ProductOption } from '@/product/domain/entities/product-option.entity';
import { User } from '@/user/domain/entities/user.entity';
import { OrderStatus } from '@/order/domain/entities/order-status.vo';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import {
  setupDatabaseTest,
  cleanupDatabase,
  teardownIntegrationTest,
} from '../setup';

describe('OrderExpirationScheduler Integration Tests', () => {
  let prismaService: PrismaService;
  let scheduler: OrderExpirationScheduler;
  let orderRepository: OrderPrismaRepository;
  let orderItemRepository: OrderItemRepository;
  let productRepository: ProductPrismaRepository;
  let productOptionRepository: ProductOptionRepository;
  let userRepository: UserPrismaRepository;

  beforeAll(async () => {
    prismaService = await setupDatabaseTest();
  }, 60000); // 60초 타임아웃

  afterAll(async () => {
    await teardownIntegrationTest();
  }, 60000); // 60초 타임아웃

  beforeEach(async () => {
    await cleanupDatabase(prismaService);

    orderRepository = new OrderPrismaRepository(prismaService);
    orderItemRepository = new OrderItemRepository(prismaService);
    productRepository = new ProductPrismaRepository(prismaService);
    productOptionRepository = new ProductOptionRepository(prismaService);
    userRepository = new UserPrismaRepository(prismaService);

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
