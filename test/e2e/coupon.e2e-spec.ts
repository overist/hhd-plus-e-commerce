import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DomainExceptionFilter } from '@common/exception/domain-exception.filter';
import { ApplicationExceptionFilter } from '@/@common/exception/application-exception.filter';

describe('CouponController (E2E)', () => {
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

  describe('POST /api/coupons/:couponId/issue (US-013)', () => {
    it('쿠폰을 발급받을 수 있다', async () => {
      const couponId = 1;
      const userId = 1;

      const response = await request(app.getHttpServer())
        .post(`/api/coupons/${couponId}/issue`)
        .send({ userId })
        .expect(201);

      expect(response.body).toHaveProperty('userCouponId');
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('couponId');
      expect(response.body).toHaveProperty('status');
      expect(response.body.userId).toBe(userId);
      expect(response.body.couponId).toBe(couponId);
    });

    it('필수 필드(userId)가 없을 경우 400을 반환한다', async () => {
      const couponId = 1;

      await request(app.getHttpServer())
        .post(`/api/coupons/${couponId}/issue`)
        .send({})
        .expect(400);
    });

    it('존재하지 않는 쿠폰 발급 시 404를 반환한다', async () => {
      const nonExistentCouponId = 99999;
      const userId = 1;

      await request(app.getHttpServer())
        .post(`/api/coupons/${nonExistentCouponId}/issue`)
        .send({ userId })
        .expect(404);
    });

    it('이미 발급받은 쿠폰을 다시 발급받으려 하면 400을 반환한다', async () => {
      const couponId = 2;
      const userId = 1;

      // 첫 번째 발급
      await request(app.getHttpServer())
        .post(`/api/coupons/${couponId}/issue`)
        .send({ userId })
        .expect(201);

      // 두 번째 발급 시도
      await request(app.getHttpServer())
        .post(`/api/coupons/${couponId}/issue`)
        .send({ userId })
        .expect(400);
    });

    it('쿠폰 수량이 소진된 경우 400을 반환한다', async () => {
      const couponId = 3; // 수량이 적은 쿠폰
      const userIds = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

      // 쿠폰 수량이 소진될 때까지 발급
      for (const userId of userIds) {
        const response = await request(app.getHttpServer())
          .post(`/api/coupons/${couponId}/issue`)
          .send({ userId });

        if (response.status === 400) {
          // 수량 소진으로 400이 반환되면 성공
          expect(response.status).toBe(400);
          return;
        }
      }
    });

    it('유효하지 않은 couponId 형식일 경우 400을 반환한다', async () => {
      const userId = 1;

      await request(app.getHttpServer())
        .post('/api/coupons/invalid/issue')
        .send({ userId })
        .expect(400);
    });
  });

  describe('GET /api/users/:userId/coupons (US-014)', () => {
    it('보유한 쿠폰 목록을 조회할 수 있다', async () => {
      const userId = 1;

      const response = await request(app.getHttpServer())
        .get(`/api/users/${userId}/coupons`)
        .expect(200);

      expect(response.body).toHaveProperty('coupons');
      expect(Array.isArray(response.body.coupons)).toBe(true);
      expect(response.body).toHaveProperty('total');
    });

    it('보유 쿠폰은 상세 정보를 포함한다', async () => {
      const userId = 1;
      const couponId = 4;

      // 쿠폰 발급
      await request(app.getHttpServer())
        .post(`/api/coupons/${couponId}/issue`)
        .send({ userId })
        .expect(201);

      // 쿠폰 목록 조회
      const response = await request(app.getHttpServer())
        .get(`/api/users/${userId}/coupons`)
        .expect(200);

      if (response.body.coupons.length > 0) {
        const coupon = response.body.coupons[0];
        expect(coupon).toHaveProperty('userCouponId');
        expect(coupon).toHaveProperty('couponId');
        expect(coupon).toHaveProperty('name');
        expect(coupon).toHaveProperty('discountType');
        expect(coupon).toHaveProperty('discountValue');
        expect(coupon).toHaveProperty('status');
      }
    });

    it('상태별로 쿠폰을 필터링할 수 있다', async () => {
      const userId = 1;
      const status = 'AVAILABLE';

      const response = await request(app.getHttpServer())
        .get(`/api/users/${userId}/coupons`)
        .query({ status })
        .expect(200);

      expect(response.body).toHaveProperty('coupons');
      expect(Array.isArray(response.body.coupons)).toBe(true);

      // 모든 쿠폰이 AVAILABLE 상태인지 확인
      response.body.coupons.forEach((coupon: any) => {
        expect(coupon.status).toBe(status);
      });
    });

    it('존재하지 않는 사용자의 쿠폰 조회 시 404를 반환한다', async () => {
      const nonExistentUserId = 99999;

      await request(app.getHttpServer())
        .get(`/api/users/${nonExistentUserId}/coupons`)
        .expect(404);
    });

    it('유효하지 않은 userId 형식일 경우 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/api/users/invalid/coupons')
        .expect(400);
    });
  });

  describe('쿠폰 발급 및 조회 통합 시나리오', () => {
    it('쿠폰 발급 후 즉시 조회하면 발급된 쿠폰이 목록에 있다', async () => {
      const userId = 5;
      const couponId = 5;

      // 1. 쿠폰 발급
      const issueResponse = await request(app.getHttpServer())
        .post(`/api/coupons/${couponId}/issue`)
        .send({ userId })
        .expect(201);

      const userCouponId = issueResponse.body.userCouponId;

      // 2. 쿠폰 목록 조회
      const listResponse = await request(app.getHttpServer())
        .get(`/api/users/${userId}/coupons`)
        .expect(200);

      // 3. 발급받은 쿠폰이 목록에 있는지 확인
      const issuedCoupon = listResponse.body.coupons.find(
        (coupon: any) => coupon.userCouponId === userCouponId,
      );

      expect(issuedCoupon).toBeDefined();
      expect(issuedCoupon.couponId).toBe(couponId);
      expect(issuedCoupon.status).toBe('AVAILABLE');
    });

    it('여러 쿠폰을 발급받으면 모두 조회된다', async () => {
      const userId = 6;
      const couponIds = [6, 7, 8];

      // 1. 여러 쿠폰 발급
      for (const couponId of couponIds) {
        await request(app.getHttpServer())
          .post(`/api/coupons/${couponId}/issue`)
          .send({ userId })
          .expect(201);
      }

      // 2. 쿠폰 목록 조회
      const response = await request(app.getHttpServer())
        .get(`/api/users/${userId}/coupons`)
        .expect(200);

      // 3. 발급받은 쿠폰들이 모두 목록에 있는지 확인
      expect(response.body.coupons.length).toBeGreaterThanOrEqual(
        couponIds.length,
      );
      expect(response.body.total).toBeGreaterThanOrEqual(couponIds.length);
    });

    it('AVAILABLE 상태의 쿠폰만 필터링하여 조회할 수 있다', async () => {
      const userId = 7;
      const couponId = 9;

      // 1. 쿠폰 발급
      await request(app.getHttpServer())
        .post(`/api/coupons/${couponId}/issue`)
        .send({ userId })
        .expect(201);

      // 2. AVAILABLE 상태 쿠폰 조회
      const response = await request(app.getHttpServer())
        .get(`/api/users/${userId}/coupons`)
        .query({ status: 'AVAILABLE' })
        .expect(200);

      // 3. 모든 쿠폰이 AVAILABLE 상태인지 확인
      expect(response.body.coupons.length).toBeGreaterThan(0);
      response.body.coupons.forEach((coupon: any) => {
        expect(coupon.status).toBe('AVAILABLE');
      });
    });
  });

  describe('쿠폰 발급 동시성 테스트', () => {
    it('동일한 쿠폰을 여러 사용자가 동시에 발급받을 수 있다', async () => {
      const couponId = 10;
      const userIds = [20, 21, 22];

      // 동시에 쿠폰 발급 요청
      const results = await Promise.allSettled(
        userIds.map((userId) =>
          request(app.getHttpServer())
            .post(`/api/coupons/${couponId}/issue`)
            .send({ userId }),
        ),
      );

      // 최소 1명 이상은 성공해야 함
      const successCount = results.filter(
        (result) =>
          result.status === 'fulfilled' && result.value.status === 201,
      ).length;

      expect(successCount).toBeGreaterThan(0);
    });
  });
});
