import { OrderDomainService } from '@/order/domain/services/order.service';
import {
  IOrderRepository,
  IOrderItemRepository,
} from '@/order/domain/interfaces/order.repository.interface';
import { Order } from '@/order/domain/entities/order.entity';
import { OrderItem } from '@/order/domain/entities/order-item.entity';
import { OrderStatus } from '@/order/domain/entities/order-status.vo';
import { ErrorCode } from '@common/exception';

describe('OrderDomainService', () => {
  let service: OrderDomainService;
  let orderRepository: jest.Mocked<IOrderRepository>;
  let orderItemRepository: jest.Mocked<IOrderItemRepository>;

  beforeEach(() => {
    orderRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findManyByUserId: jest.fn(),
    } as any;

    orderItemRepository = {
      create: jest.fn(),
      createMany: jest.fn(),
      findManyByOrderId: jest.fn(),
    } as any;

    service = new OrderDomainService(orderRepository, orderItemRepository);
  });

  describe('createOrder', () => {
    it('given: 유효한 주문 엔티티가 주어짐 / when: createOrder 메서드를 호출함 / then: 생성된 주문을 반환함', async () => {
      // given
      const order = new Order(
        0,
        1,
        null,
        10000,
        0,
        10000,
        OrderStatus.PENDING,
        new Date(),
        null,
        new Date(Date.now() + 10 * 60 * 1000),
        new Date(),
      );
      const createdOrder = { ...order, id: 1 };
      orderRepository.create.mockResolvedValue(createdOrder as any);

      // when
      const result = await service.createOrder(order);

      // then
      expect(result).toEqual(createdOrder);
      expect(orderRepository.create).toHaveBeenCalledWith(order);
    });
  });

  describe('createOrderItem', () => {
    it('given: 유효한 주문 아이템 엔티티가 주어짐 / when: createOrderItem 메서드를 호출함 / then: 생성된 주문 아이템을 반환함', async () => {
      // given
      const orderItem = new OrderItem(
        0,
        1,
        1,
        '상품명',
        5000,
        2,
        10000,
        new Date(),
      );
      const createdOrderItem = { ...orderItem, id: 1 };
      orderItemRepository.create.mockResolvedValue(createdOrderItem as any);

      // when
      const result = await service.createOrderItem(orderItem);

      // then
      expect(result).toEqual(createdOrderItem);
      expect(orderItemRepository.create).toHaveBeenCalledWith(orderItem);
    });
  });

  describe('createOrderItems', () => {
    it('given: 주문 ID와 아이템 데이터 배열이 주어짐 / when: createOrderItems 메서드를 호출함 / then: 생성된 주문 아이템 배열을 반환함', async () => {
      // given
      const orderId = 1;
      const itemsData = [
        {
          productOptionId: 1,
          productName: '상품1',
          price: 5000,
          quantity: 2,
        },
        {
          productOptionId: 2,
          productName: '상품2',
          price: 3000,
          quantity: 1,
        },
      ];
      const createdOrderItems = [
        new OrderItem(1, orderId, 1, '상품1', 5000, 2, 10000, new Date()),
        new OrderItem(2, orderId, 2, '상품2', 3000, 1, 3000, new Date()),
      ];
      orderItemRepository.createMany.mockResolvedValue(
        createdOrderItems as any,
      );

      // when
      const result = await service.createOrderItems(orderId, itemsData);

      // then
      expect(result).toHaveLength(2);
      expect(result[0].productName).toBe('상품1');
      expect(result[0].subtotal).toBe(10000);
      expect(result[1].productName).toBe('상품2');
      expect(result[1].subtotal).toBe(3000);
      expect(orderItemRepository.createMany).toHaveBeenCalledTimes(1);
    });

    it('given: 빈 아이템 데이터 배열이 주어짐 / when: createOrderItems 메서드를 호출함 / then: 빈 배열을 반환함', async () => {
      // given
      const orderId = 1;
      const itemsData = [];
      orderItemRepository.createMany.mockResolvedValue([]);

      // when
      const result = await service.createOrderItems(orderId, itemsData);

      // then
      expect(result).toEqual([]);
      expect(orderItemRepository.createMany).toHaveBeenCalledWith([]);
    });
  });

  describe('createPendingOrder', () => {
    it('given: 사용자 ID와 총 금액이 주어짐 / when: createPendingOrder 메서드를 호출함 / then: PENDING 상태의 주문을 생성하여 반환함', async () => {
      // given
      const userId = 1;
      const totalAmount = 10000;
      const createdOrder = new Order(
        1,
        userId,
        null,
        totalAmount,
        0,
        totalAmount,
        OrderStatus.PENDING,
        new Date('2024-01-01T00:00:00Z'),
        null,
        new Date('2024-01-01T00:10:00Z'),
        new Date('2024-01-01T00:00:00Z'),
      );
      orderRepository.create.mockResolvedValue(createdOrder as any);

      // when
      const result = await service.createPendingOrder(userId, totalAmount);

      // then
      expect(result.userId).toBe(userId);
      expect(result.totalAmount).toBe(totalAmount);
      expect(result.status).toBe(OrderStatus.PENDING);
      expect(result.discountAmount).toBe(0);
      expect(result.finalAmount).toBe(totalAmount);
      expect(orderRepository.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateOrder', () => {
    it('given: 주문 엔티티가 주어짐 / when: updateOrder 메서드를 호출함 / then: 업데이트된 주문을 반환함', async () => {
      // given
      const futureTime = new Date(Date.now() + 20 * 60 * 1000); // 20분 후
      const order = new Order(
        1,
        1,
        null,
        10000,
        0,
        10000,
        OrderStatus.PENDING,
        new Date(),
        null,
        futureTime,
        new Date(),
      );
      order.beginPaymentProcessing();
      order.completePayment();
      orderRepository.update.mockResolvedValue(order as any);

      // when
      const result = await service.updateOrder(order);

      // then
      expect(result.status).toBe(OrderStatus.PAID);
      expect(orderRepository.update).toHaveBeenCalledWith(order);
    });
  });

  describe('getOrder', () => {
    it('given: 존재하는 주문 ID가 주어짐 / when: getOrder 메서드를 호출함 / then: 주문을 반환함', async () => {
      // given
      const orderId = 1;
      const order = new Order(
        orderId,
        1,
        null,
        10000,
        0,
        10000,
        OrderStatus.PENDING,
        new Date('2024-01-01T00:00:00Z'),
        null,
        new Date('2024-01-01T00:10:00Z'),
        new Date('2024-01-01T00:00:00Z'),
      );
      orderRepository.findById.mockResolvedValue(order as any);

      // when
      const result = await service.getOrder(orderId);

      // then
      expect(result).toEqual(order);
      expect(orderRepository.findById).toHaveBeenCalledWith(orderId);
    });

    it('given: 존재하지 않는 주문 ID가 주어짐 / when: getOrder 메서드를 호출함 / then: DomainException을 발생시킴', async () => {
      // given
      const orderId = 999;
      orderRepository.findById.mockResolvedValue(null);

      // when & then
      try {
        await service.getOrder(orderId);
        fail('예외가 발생해야 합니다');
      } catch (error) {
        expect(error.name).toBe('DomainException');
        expect(error.errorCode).toBe(ErrorCode.ORDER_NOT_FOUND);
      }
    });
  });

  describe('getOrderItems', () => {
    it('given: 주문 ID가 주어짐 / when: getOrderItems 메서드를 호출함 / then: 주문 아이템 배열을 반환함', async () => {
      // given
      const orderId = 1;
      const orderItems = [
        new OrderItem(1, orderId, 1, '상품1', 5000, 2, 10000, new Date()),
        new OrderItem(2, orderId, 2, '상품2', 3000, 1, 3000, new Date()),
      ];
      orderItemRepository.findManyByOrderId.mockResolvedValue(
        orderItems as any,
      );

      // when
      const result = await service.getOrderItems(orderId);

      // then
      expect(result).toHaveLength(2);
      expect(result[0].productName).toBe('상품1');
      expect(result[1].productName).toBe('상품2');
      expect(orderItemRepository.findManyByOrderId).toHaveBeenCalledWith(
        orderId,
      );
    });

    it('given: 주문 아이템이 없는 주문 ID가 주어짐 / when: getOrderItems 메서드를 호출함 / then: 빈 배열을 반환함', async () => {
      // given
      const orderId = 1;
      orderItemRepository.findManyByOrderId.mockResolvedValue([]);

      // when
      const result = await service.getOrderItems(orderId);

      // then
      expect(result).toEqual([]);
      expect(orderItemRepository.findManyByOrderId).toHaveBeenCalledWith(
        orderId,
      );
    });
  });

  describe('getOrders', () => {
    it('given: 사용자 ID가 주어짐 / when: getOrders 메서드를 호출함 / then: 사용자의 주문 목록을 반환함', async () => {
      // given
      const userId = 1;
      const orders = [
        new Order(
          1,
          userId,
          null,
          10000,
          0,
          10000,
          OrderStatus.PENDING,
          new Date('2024-01-01T00:00:00Z'),
          null,
          new Date('2024-01-01T00:10:00Z'),
          new Date('2024-01-01T00:00:00Z'),
        ),
        new Order(
          2,
          userId,
          null,
          20000,
          0,
          20000,
          OrderStatus.PAID,
          new Date('2024-01-01T00:00:00Z'),
          new Date('2024-01-01T00:05:00Z'),
          new Date('2024-01-01T00:10:00Z'),
          new Date('2024-01-01T00:00:00Z'),
        ),
      ];
      orderRepository.findManyByUserId.mockResolvedValue(orders as any);

      // when
      const result = await service.getOrders(userId);

      // then
      expect(result).toHaveLength(2);
      expect(result[0].totalAmount).toBe(10000);
      expect(result[1].totalAmount).toBe(20000);
      expect(orderRepository.findManyByUserId).toHaveBeenCalledWith(userId);
    });

    it('given: 주문이 없는 사용자 ID가 주어짐 / when: getOrders 메서드를 호출함 / then: 빈 배열을 반환함', async () => {
      // given
      const userId = 999;
      orderRepository.findManyByUserId.mockResolvedValue([]);

      // when
      const result = await service.getOrders(userId);

      // then
      expect(result).toEqual([]);
      expect(orderRepository.findManyByUserId).toHaveBeenCalledWith(userId);
    });
  });
});
