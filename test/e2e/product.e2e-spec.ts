import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DomainExceptionFilter } from '@common/exception/domain-exception.filter';
import { ValidationExceptionFilter } from '@common/exception/validation-exception.filter';

describe('ProductController (E2E)', () => {
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
      new ValidationExceptionFilter(),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/products (US-001)', () => {
    it('상품 목록을 조회할 수 있다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products')
        .expect(200);

      expect(response.body).toHaveProperty('products');
      expect(Array.isArray(response.body.products)).toBe(true);
      expect(response.body).toHaveProperty('total');
    });

    it('조회된 상품은 필수 정보를 포함한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products')
        .expect(200);

      if (response.body.products.length > 0) {
        const product = response.body.products[0];
        expect(product).toHaveProperty('id');
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('description');
        expect(product).toHaveProperty('price');
        expect(product).toHaveProperty('category');
        expect(product).toHaveProperty('isActive');
      }
    });
  });

  describe('GET /api/products/top (US-003)', () => {
    it('상위 상품 목록을 조회할 수 있다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products/top')
        .expect(200);

      expect(response.body).toHaveProperty('products');
      expect(Array.isArray(response.body.products)).toBe(true);
    });

    it('상위 상품은 최대 5개까지 조회된다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products/top')
        .expect(200);

      expect(response.body.products.length).toBeLessThanOrEqual(5);
    });

    it('상위 상품은 판매량 정보를 포함한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products/top')
        .expect(200);

      if (response.body.products.length > 0) {
        const product = response.body.products[0];
        expect(product).toHaveProperty('id');
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('totalSales');
        expect(typeof product.totalSales).toBe('number');
      }
    });
  });

  describe('GET /api/products/:productId (US-002)', () => {
    it('상품 상세 정보를 조회할 수 있다', async () => {
      const productId = 1;

      const response = await request(app.getHttpServer())
        .get(`/api/products/${productId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('price');
      expect(response.body).toHaveProperty('category');
      expect(response.body).toHaveProperty('options');
      expect(Array.isArray(response.body.options)).toBe(true);
    });

    it('상품 옵션 정보를 포함한다', async () => {
      const productId = 1;

      const response = await request(app.getHttpServer())
        .get(`/api/products/${productId}`)
        .expect(200);

      if (response.body.options.length > 0) {
        const option = response.body.options[0];
        expect(option).toHaveProperty('id');
        expect(option).toHaveProperty('color');
        expect(option).toHaveProperty('size');
        expect(option).toHaveProperty('stock');
      }
    });

    it('존재하지 않는 상품 조회 시 404를 반환한다', async () => {
      const nonExistentProductId = 99999;

      await request(app.getHttpServer())
        .get(`/api/products/${nonExistentProductId}`)
        .expect(404);
    });

    it('유효하지 않은 productId 형식일 경우 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/api/products/invalid')
        .expect(400);
    });
  });

  describe('상품 조회 통합 시나리오', () => {
    it('상품 목록에서 조회한 상품의 상세 정보를 조회할 수 있다', async () => {
      // 1. 상품 목록 조회
      const listResponse = await request(app.getHttpServer())
        .get('/api/products')
        .expect(200);

      expect(listResponse.body.products.length).toBeGreaterThan(0);
      const firstProduct = listResponse.body.products[0];

      // 2. 첫 번째 상품의 상세 정보 조회
      const detailResponse = await request(app.getHttpServer())
        .get(`/api/products/${firstProduct.id}`)
        .expect(200);

      // 3. 검증
      expect(detailResponse.body.id).toBe(firstProduct.id);
      expect(detailResponse.body.name).toBe(firstProduct.name);
    });

    it('상위 상품 목록의 상품도 상세 조회가 가능하다', async () => {
      // 1. 상위 상품 조회
      const topResponse = await request(app.getHttpServer())
        .get('/api/products/top')
        .expect(200);

      if (topResponse.body.products.length > 0) {
        const topProduct = topResponse.body.products[0];

        // 2. 상위 상품의 상세 정보 조회
        const detailResponse = await request(app.getHttpServer())
          .get(`/api/products/${topProduct.id}`)
          .expect(200);

        // 3. 검증
        expect(detailResponse.body.id).toBe(topProduct.id);
        expect(detailResponse.body).toHaveProperty('options');
      }
    });
  });
});
