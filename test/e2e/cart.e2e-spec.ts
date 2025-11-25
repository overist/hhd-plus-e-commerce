import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DomainExceptionFilter } from '@common/exception/domain-exception.filter';
import { ApplicationExceptionFilter } from '@common/exception/application-exception.filter';

describe('CartController (E2E)', () => {
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

  describe('POST /api/users/:userId/cart (US-005)', () => {
    it('장바구니에 상품을 추가할 수 있다', async () => {
      const userId = 1;
      const productOptionId = 1;
      const quantity = 2;

      const response = await request(app.getHttpServer())
        .post(`/api/users/${userId}/cart`)
        .send({ productOptionId, quantity })
        .expect(201);

      expect(response.body).toHaveProperty('cartItemId');
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('productOptionId');
      expect(response.body).toHaveProperty('quantity');
      expect(response.body.userId).toBe(userId);
      expect(response.body.productOptionId).toBe(productOptionId);
    });

    it('수량이 0이하일 경우 400을 반환한다', async () => {
      const userId = 1;
      const productOptionId = 1;

      await request(app.getHttpServer())
        .post(`/api/users/${userId}/cart`)
        .send({ productOptionId, quantity: 0 })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/users/${userId}/cart`)
        .send({ productOptionId, quantity: -1 })
        .expect(400);
    });

    it('필수 필드가 없을 경우 400을 반환한다', async () => {
      const userId = 1;

      await request(app.getHttpServer())
        .post(`/api/users/${userId}/cart`)
        .send({ quantity: 2 })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/users/${userId}/cart`)
        .send({ productOptionId: 1 })
        .expect(400);
    });

    it('존재하지 않는 상품 옵션 추가 시 404를 반환한다', async () => {
      const userId = 1;
      const nonExistentOptionId = 99999;

      await request(app.getHttpServer())
        .post(`/api/users/${userId}/cart`)
        .send({ productOptionId: nonExistentOptionId, quantity: 1 })
        .expect(404);
    });

    it('재고보다 많은 수량 추가 시 400을 반환한다', async () => {
      const userId = 1;
      const productOptionId = 1;
      const excessiveQuantity = 999999;

      await request(app.getHttpServer())
        .post(`/api/users/${userId}/cart`)
        .send({ productOptionId, quantity: excessiveQuantity })
        .expect(400);
    });
  });

  describe('GET /api/users/:userId/cart (US-006)', () => {
    it('장바구니 목록을 조회할 수 있다', async () => {
      const userId = 1;

      const response = await request(app.getHttpServer())
        .get(`/api/users/${userId}/cart`)
        .expect(200);

      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.userId).toBe(userId);
    });

    it('장바구니 항목은 상품 정보를 포함한다', async () => {
      const userId = 1;

      // 먼저 장바구니에 상품 추가
      await request(app.getHttpServer())
        .post(`/api/users/${userId}/cart`)
        .send({ productOptionId: 1, quantity: 1 })
        .expect(201);

      // 장바구니 조회
      const response = await request(app.getHttpServer())
        .get(`/api/users/${userId}/cart`)
        .expect(200);

      if (response.body.items.length > 0) {
        const item = response.body.items[0];
        expect(item).toHaveProperty('cartItemId');
        expect(item).toHaveProperty('productOptionId');
        expect(item).toHaveProperty('quantity');
        expect(item).toHaveProperty('productName');
        expect(item).toHaveProperty('price');
      }
    });

    it('존재하지 않는 사용자의 장바구니 조회 시 404를 반환한다', async () => {
      const nonExistentUserId = 99999;

      await request(app.getHttpServer())
        .get(`/api/users/${nonExistentUserId}/cart`)
        .expect(404);
    });
  });

  describe('DELETE /api/users/:userId/cart/:cartItemId (US-007)', () => {
    it('장바구니에서 상품을 삭제할 수 있다', async () => {
      const userId = 1;

      // 1. 장바구니에 상품 추가
      const addResponse = await request(app.getHttpServer())
        .post(`/api/users/${userId}/cart`)
        .send({ productOptionId: 1, quantity: 1 })
        .expect(201);

      const cartItemId = addResponse.body.cartItemId;

      // 2. 장바구니에서 상품 삭제
      await request(app.getHttpServer())
        .delete(`/api/users/${userId}/cart/${cartItemId}`)
        .expect(204);

      // 3. 장바구니 조회하여 삭제 확인
      const cartResponse = await request(app.getHttpServer())
        .get(`/api/users/${userId}/cart`)
        .expect(200);

      const deletedItem = cartResponse.body.items.find(
        (item: any) => item.cartItemId === cartItemId,
      );
      expect(deletedItem).toBeUndefined();
    });

    it('존재하지 않는 장바구니 항목 삭제 시 404를 반환한다', async () => {
      const userId = 1;
      const nonExistentCartItemId = 99999;

      await request(app.getHttpServer())
        .delete(`/api/users/${userId}/cart/${nonExistentCartItemId}`)
        .expect(404);
    });

    it('다른 사용자의 장바구니 항목 삭제 시 403을 반환한다', async () => {
      const userId1 = 1;
      const userId2 = 2;

      // 1. 사용자1의 장바구니에 상품 추가
      const addResponse = await request(app.getHttpServer())
        .post(`/api/users/${userId1}/cart`)
        .send({ productOptionId: 1, quantity: 1 })
        .expect(201);

      const cartItemId = addResponse.body.cartItemId;

      // 2. 사용자2가 사용자1의 장바구니 항목 삭제 시도
      await request(app.getHttpServer())
        .delete(`/api/users/${userId2}/cart/${cartItemId}`)
        .expect(403);
    });
  });

  describe('장바구니 통합 시나리오', () => {
    it('장바구니에 상품 추가 후 즉시 조회하면 추가된 상품이 있다', async () => {
      const userId = 1;
      const productOptionId = 1;
      const quantity = 3;

      // 1. 장바구니에 상품 추가
      const addResponse = await request(app.getHttpServer())
        .post(`/api/users/${userId}/cart`)
        .send({ productOptionId, quantity })
        .expect(201);

      // 2. 장바구니 조회
      const cartResponse = await request(app.getHttpServer())
        .get(`/api/users/${userId}/cart`)
        .expect(200);

      // 3. 추가된 상품이 장바구니에 있는지 확인
      const addedItem = cartResponse.body.items.find(
        (item: any) => item.cartItemId === addResponse.body.cartItemId,
      );

      expect(addedItem).toBeDefined();
      expect(addedItem.quantity).toBe(quantity);
    });

    it('동일한 상품을 여러 번 추가하면 수량이 증가한다', async () => {
      const userId = 1;
      const productOptionId = 1;

      // 1. 첫 번째 추가
      await request(app.getHttpServer())
        .post(`/api/users/${userId}/cart`)
        .send({ productOptionId, quantity: 2 })
        .expect(201);

      // 2. 동일 상품 두 번째 추가
      await request(app.getHttpServer())
        .post(`/api/users/${userId}/cart`)
        .send({ productOptionId, quantity: 3 })
        .expect(201);

      // 3. 장바구니 조회
      const cartResponse = await request(app.getHttpServer())
        .get(`/api/users/${userId}/cart`)
        .expect(200);

      // 4. 수량이 합산되었는지 확인
      const item = cartResponse.body.items.find(
        (i: any) => i.productOptionId === productOptionId,
      );

      expect(item).toBeDefined();
      expect(item.quantity).toBeGreaterThanOrEqual(5);
    });

    it('장바구니 추가, 조회, 삭제 전체 플로우가 정상 동작한다', async () => {
      const userId = 1;
      const productOptionId = 2;

      // 1. 장바구니에 상품 추가
      const addResponse = await request(app.getHttpServer())
        .post(`/api/users/${userId}/cart`)
        .send({ productOptionId, quantity: 1 })
        .expect(201);

      const cartItemId = addResponse.body.cartItemId;

      // 2. 장바구니 조회 - 상품이 있는지 확인
      const beforeDelete = await request(app.getHttpServer())
        .get(`/api/users/${userId}/cart`)
        .expect(200);

      const beforeItem = beforeDelete.body.items.find(
        (item: any) => item.cartItemId === cartItemId,
      );
      expect(beforeItem).toBeDefined();

      // 3. 장바구니에서 상품 삭제
      await request(app.getHttpServer())
        .delete(`/api/users/${userId}/cart/${cartItemId}`)
        .expect(204);

      // 4. 장바구니 조회 - 상품이 없는지 확인
      const afterDelete = await request(app.getHttpServer())
        .get(`/api/users/${userId}/cart`)
        .expect(200);

      const afterItem = afterDelete.body.items.find(
        (item: any) => item.cartItemId === cartItemId,
      );
      expect(afterItem).toBeUndefined();
    });
  });
});
