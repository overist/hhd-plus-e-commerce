import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DomainExceptionFilter } from '@common/exception/domain-exception.filter';
import { ApplicationExceptionFilter } from '@common/exception/application-exception.filter';

describe('OrderController (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // 글로벌 파이프 및 필터 설정
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(
      new DomainExceptionFilter(),
      new ApplicationExceptionFilter(),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/orders (US-008)', () => {
    it('주문서를 생성할 수 있다', async () => {
      const userId = 1;
      const items = [
        { productOptionId: 1, quantity: 2 },
        { productOptionId: 2, quantity: 1 },
      ];

      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .send({ userId, items })
        .expect(201);

      expect(response.body).toHaveProperty('orderId');
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body).toHaveProperty('status');
      expect(response.body.userId).toBe(userId);
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('필수 필드가 없을 경우 400을 반환한다', async () => {
      // userId 없음
      await request(app.getHttpServer())
        .post('/api/orders')
        .send({ items: [{ productOptionId: 1, quantity: 1 }] })
        .expect(400);

      // items 없음
      await request(app.getHttpServer())
        .post('/api/orders')
        .send({ userId: 1 })
        .expect(400);
    });

    it('빈 주문 항목으로 주문서 생성 시 400을 반환한다', async () => {
      const userId = 1;

      await request(app.getHttpServer())
        .post('/api/orders')
        .send({ userId, items: [] })
        .expect(400);
    });

    it('재고가 부족한 경우 400을 반환한다', async () => {
      const userId = 1;
      const items = [{ productOptionId: 1, quantity: 999999 }];

      await request(app.getHttpServer())
        .post('/api/orders')
        .send({ userId, items })
        .expect(400);
    });

    it('존재하지 않는 상품 옵션으로 주문 시 404를 반환한다', async () => {
      const userId = 1;
      const items = [{ productOptionId: 99999, quantity: 1 }];

      await request(app.getHttpServer())
        .post('/api/orders')
        .send({ userId, items })
        .expect(404);
    });

    it('존재하지 않는 사용자로 주문 시 404를 반환한다', async () => {
      const nonExistentUserId = 99999;
      const items = [{ productOptionId: 1, quantity: 1 }];

      await request(app.getHttpServer())
        .post('/api/orders')
        .send({ userId: nonExistentUserId, items })
        .expect(404);
    });
  });

  describe('POST /api/orders/:orderId/payment (US-009)', () => {
    it('주문에 대한 결제를 처리할 수 있다', async () => {
      const userId = 1;

      // 1. 주문서 생성
      const orderResponse = await request(app.getHttpServer())
        .post('/api/orders')
        .send({
          userId,
          items: [{ productOptionId: 1, quantity: 1 }],
        })
        .expect(201);

      const orderId = orderResponse.body.orderId;

      // 2. 결제 처리
      const paymentResponse = await request(app.getHttpServer())
        .post(`/api/orders/${orderId}/payment`)
        .send({ userId })
        .expect(200);

      expect(paymentResponse.body).toHaveProperty('orderId');
      expect(paymentResponse.body).toHaveProperty('status');
      expect(paymentResponse.body).toHaveProperty('paidAmount');
      expect(paymentResponse.body.orderId).toBe(orderId);
      expect(paymentResponse.body.status).toBe('PAID');
    });

    it('쿠폰을 적용하여 결제할 수 있다', async () => {
      const userId = 1;
      const couponId = 1;

      // 1. 쿠폰 발급
      const couponResponse = await request(app.getHttpServer())
        .post(`/api/coupons/${couponId}/issue`)
        .send({ userId });

      const userCouponId =
        couponResponse.status === 201
          ? couponResponse.body.userCouponId
          : undefined;

      // 2. 주문서 생성
      const orderResponse = await request(app.getHttpServer())
        .post('/api/orders')
        .send({
          userId,
          items: [{ productOptionId: 1, quantity: 1 }],
        })
        .expect(201);

      const orderId = orderResponse.body.orderId;

      // 3. 쿠폰을 적용하여 결제
      if (userCouponId) {
        const paymentResponse = await request(app.getHttpServer())
          .post(`/api/orders/${orderId}/payment`)
          .send({ userId, userCouponId })
          .expect(200);

        expect(paymentResponse.body).toHaveProperty('discountAmount');
        expect(paymentResponse.body.status).toBe('PAID');
      }
    });

    it('필수 필드(userId)가 없을 경우 400을 반환한다', async () => {
      const orderId = 1;

      await request(app.getHttpServer())
        .post(`/api/orders/${orderId}/payment`)
        .send({})
        .expect(400);
    });

    it('잔액이 부족한 경우 400을 반환한다', async () => {
      const userId = 1;

      // 1. 주문서 생성
      const orderResponse = await request(app.getHttpServer())
        .post('/api/orders')
        .send({
          userId,
          items: [{ productOptionId: 1, quantity: 100 }], // 큰 금액
        });

      if (orderResponse.status === 201) {
        const orderId = orderResponse.body.orderId;

        // 2. 잔액 부족으로 결제 실패
        await request(app.getHttpServer())
          .post(`/api/orders/${orderId}/payment`)
          .send({ userId })
          .expect(400);
      }
    });

    it('존재하지 않는 주문에 대한 결제 시 404를 반환한다', async () => {
      const nonExistentOrderId = 99999;
      const userId = 1;

      await request(app.getHttpServer())
        .post(`/api/orders/${nonExistentOrderId}/payment`)
        .send({ userId })
        .expect(404);
    });

    it('다른 사용자의 주문에 결제 시도 시 403을 반환한다', async () => {
      const userId1 = 1;
      const userId2 = 2;

      // 1. 사용자1이 주문 생성
      const orderResponse = await request(app.getHttpServer())
        .post('/api/orders')
        .send({
          userId: userId1,
          items: [{ productOptionId: 1, quantity: 1 }],
        })
        .expect(201);

      const orderId = orderResponse.body.orderId;

      // 2. 사용자2가 결제 시도
      await request(app.getHttpServer())
        .post(`/api/orders/${orderId}/payment`)
        .send({ userId: userId2 })
        .expect(403);
    });

    it('이미 결제된 주문에 재결제 시도 시 400을 반환한다', async () => {
      const userId = 1;

      // 1. 주문서 생성
      const orderResponse = await request(app.getHttpServer())
        .post('/api/orders')
        .send({
          userId,
          items: [{ productOptionId: 1, quantity: 1 }],
        })
        .expect(201);

      const orderId = orderResponse.body.orderId;

      // 2. 첫 번째 결제
      await request(app.getHttpServer())
        .post(`/api/orders/${orderId}/payment`)
        .send({ userId })
        .expect(200);

      // 3. 두 번째 결제 시도
      await request(app.getHttpServer())
        .post(`/api/orders/${orderId}/payment`)
        .send({ userId })
        .expect(400);
    });
  });

  describe('GET /api/orders/users/:userId (US-012)', () => {
    it('사용자의 주문 내역을 조회할 수 있다', async () => {
      const userId = 1;

      const response = await request(app.getHttpServer())
        .get(`/api/orders/users/${userId}`)
        .expect(200);

      expect(response.body).toHaveProperty('orders');
      expect(Array.isArray(response.body.orders)).toBe(true);
      expect(response.body).toHaveProperty('total');
    });

    it('주문 내역은 상세 정보를 포함한다', async () => {
      const userId = 1;

      // 주문 생성
      await request(app.getHttpServer())
        .post('/api/orders')
        .send({
          userId,
          items: [{ productOptionId: 1, quantity: 1 }],
        })
        .expect(201);

      // 주문 내역 조회
      const response = await request(app.getHttpServer())
        .get(`/api/orders/users/${userId}`)
        .expect(200);

      if (response.body.orders.length > 0) {
        const order = response.body.orders[0];
        expect(order).toHaveProperty('orderId');
        expect(order).toHaveProperty('status');
        expect(order).toHaveProperty('totalAmount');
        expect(order).toHaveProperty('createdAt');
      }
    });

    it('상태별로 주문 내역을 필터링할 수 있다', async () => {
      const userId = 1;
      const status = 'PAID';

      const response = await request(app.getHttpServer())
        .get(`/api/orders/users/${userId}`)
        .query({ status })
        .expect(200);

      expect(response.body).toHaveProperty('orders');
      expect(Array.isArray(response.body.orders)).toBe(true);

      // 모든 주문이 PAID 상태인지 확인
      response.body.orders.forEach((order: any) => {
        expect(order.status).toBe(status);
      });
    });

    it('존재하지 않는 사용자의 주문 내역 조회 시 404를 반환한다', async () => {
      const nonExistentUserId = 99999;

      await request(app.getHttpServer())
        .get(`/api/orders/users/${nonExistentUserId}`)
        .expect(404);
    });
  });

  describe('GET /api/orders/:orderId', () => {
    it('주문 상세 정보를 조회할 수 있다', async () => {
      const userId = 1;

      // 1. 주문 생성
      const orderResponse = await request(app.getHttpServer())
        .post('/api/orders')
        .send({
          userId,
          items: [{ productOptionId: 1, quantity: 2 }],
        })
        .expect(201);

      const orderId = orderResponse.body.orderId;

      // 2. 주문 상세 조회
      const detailResponse = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .expect(200);

      expect(detailResponse.body).toHaveProperty('orderId');
      expect(detailResponse.body).toHaveProperty('userId');
      expect(detailResponse.body).toHaveProperty('items');
      expect(detailResponse.body).toHaveProperty('totalAmount');
      expect(detailResponse.body).toHaveProperty('status');
      expect(detailResponse.body.orderId).toBe(orderId);
    });

    it('주문 항목의 상세 정보를 포함한다', async () => {
      const userId = 1;

      // 주문 생성
      const orderResponse = await request(app.getHttpServer())
        .post('/api/orders')
        .send({
          userId,
          items: [{ productOptionId: 1, quantity: 1 }],
        })
        .expect(201);

      const orderId = orderResponse.body.orderId;

      // 주문 상세 조회
      const detailResponse = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .expect(200);

      expect(detailResponse.body.items.length).toBeGreaterThan(0);
      const item = detailResponse.body.items[0];
      expect(item).toHaveProperty('productOptionId');
      expect(item).toHaveProperty('quantity');
      expect(item).toHaveProperty('price');
      expect(item).toHaveProperty('productName');
    });

    it('존재하지 않는 주문 조회 시 404를 반환한다', async () => {
      const nonExistentOrderId = 99999;

      await request(app.getHttpServer())
        .get(`/api/orders/${nonExistentOrderId}`)
        .expect(404);
    });

    it('유효하지 않은 orderId 형식일 경우 400을 반환한다', async () => {
      await request(app.getHttpServer()).get('/api/orders/invalid').expect(400);
    });
  });

  describe('주문 및 결제 전체 플로우', () => {
    it('주문 생성 -> 결제 -> 주문 조회 플로우가 정상 동작한다', async () => {
      const userId = 1;
      const items = [{ productOptionId: 1, quantity: 1 }];

      // 1. 주문 생성
      const orderResponse = await request(app.getHttpServer())
        .post('/api/orders')
        .send({ userId, items })
        .expect(201);

      const orderId = orderResponse.body.orderId;
      expect(orderResponse.body.status).toBe('PENDING');

      // 2. 결제 처리
      const paymentResponse = await request(app.getHttpServer())
        .post(`/api/orders/${orderId}/payment`)
        .send({ userId })
        .expect(200);

      expect(paymentResponse.body.status).toBe('PAID');

      // 3. 주문 상세 조회
      const detailResponse = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .expect(200);

      expect(detailResponse.body.status).toBe('PAID');

      // 4. 주문 내역에 포함되어 있는지 확인
      const listResponse = await request(app.getHttpServer())
        .get(`/api/orders/users/${userId}`)
        .expect(200);

      const foundOrder = listResponse.body.orders.find(
        (order: any) => order.orderId === orderId,
      );
      expect(foundOrder).toBeDefined();
    });

    it('여러 상품을 주문하고 결제할 수 있다', async () => {
      const userId = 1;
      const items = [
        { productOptionId: 1, quantity: 2 },
        { productOptionId: 2, quantity: 1 },
        { productOptionId: 3, quantity: 3 },
      ];

      // 1. 주문 생성
      const orderResponse = await request(app.getHttpServer())
        .post('/api/orders')
        .send({ userId, items })
        .expect(201);

      const orderId = orderResponse.body.orderId;
      expect(orderResponse.body.items.length).toBe(3);

      // 2. 결제 처리
      const paymentResponse = await request(app.getHttpServer())
        .post(`/api/orders/${orderId}/payment`)
        .send({ userId })
        .expect(200);

      expect(paymentResponse.body.status).toBe('PAID');
      expect(paymentResponse.body.paidAmount).toBeGreaterThan(0);
    });

    it('주문 생성 후 결제하지 않으면 PENDING 상태로 유지된다', async () => {
      const userId = 1;
      const items = [{ productOptionId: 1, quantity: 1 }];

      // 1. 주문 생성
      const orderResponse = await request(app.getHttpServer())
        .post('/api/orders')
        .send({ userId, items })
        .expect(201);

      const orderId = orderResponse.body.orderId;

      // 2. 결제 없이 주문 조회
      const detailResponse = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .expect(200);

      expect(detailResponse.body.status).toBe('PENDING');
    });
  });
});
