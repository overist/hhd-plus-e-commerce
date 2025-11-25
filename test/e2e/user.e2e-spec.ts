import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DomainExceptionFilter } from '@common/exception/domain-exception.filter';
import { ApplicationExceptionFilter } from '@/@common/exception/application-exception.filter';

describe('UserController (E2E)', () => {
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

  describe('GET /api/users/:userId/balance (US-004)', () => {
    it('사용자의 잔액을 조회할 수 있다', async () => {
      const userId = 1;

      const response = await request(app.getHttpServer())
        .get(`/api/users/${userId}/balance`)
        .expect(200);

      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('balance');
      expect(response.body.userId).toBe(userId);
      expect(typeof response.body.balance).toBe('number');
    });

    it('존재하지 않는 사용자의 잔액 조회 시 404를 반환한다', async () => {
      const nonExistentUserId = 99999;

      await request(app.getHttpServer())
        .get(`/api/users/${nonExistentUserId}/balance`)
        .expect(404);
    });

    it('유효하지 않은 userId 형식일 경우 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/api/users/invalid/balance')
        .expect(400);
    });
  });

  describe('PATCH /api/users/:userId/balance', () => {
    it('사용자의 잔액을 충전할 수 있다', async () => {
      const userId = 1;
      const chargeAmount = 10000;

      const response = await request(app.getHttpServer())
        .patch(`/api/users/${userId}/balance`)
        .send({ amount: chargeAmount })
        .expect(200);

      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('balance');
      expect(response.body.userId).toBe(userId);
      expect(typeof response.body.balance).toBe('number');
    });

    it('음수 금액 충전 시 400을 반환한다', async () => {
      const userId = 1;

      await request(app.getHttpServer())
        .patch(`/api/users/${userId}/balance`)
        .send({ amount: -1000 })
        .expect(400);
    });

    it('0원 충전 시 400을 반환한다', async () => {
      const userId = 1;

      await request(app.getHttpServer())
        .patch(`/api/users/${userId}/balance`)
        .send({ amount: 0 })
        .expect(400);
    });

    it('충전 금액이 없을 경우 400을 반환한다', async () => {
      const userId = 1;

      await request(app.getHttpServer())
        .patch(`/api/users/${userId}/balance`)
        .send({})
        .expect(400);
    });

    it('존재하지 않는 사용자의 잔액 충전 시 404를 반환한다', async () => {
      const nonExistentUserId = 99999;

      await request(app.getHttpServer())
        .patch(`/api/users/${nonExistentUserId}/balance`)
        .send({ amount: 10000 })
        .expect(404);
    });
  });

  describe('GET /api/users/:userId/balance/logs (US-016)', () => {
    it('사용자의 잔액 변경 이력을 조회할 수 있다', async () => {
      const userId = 1;

      const response = await request(app.getHttpServer())
        .get(`/api/users/${userId}/balance/logs`)
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      expect(Array.isArray(response.body.logs)).toBe(true);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('size');
    });

    it('페이지네이션을 적용하여 이력을 조회할 수 있다', async () => {
      const userId = 1;
      const page = 1;
      const size = 10;

      const response = await request(app.getHttpServer())
        .get(`/api/users/${userId}/balance/logs`)
        .query({ page, size })
        .expect(200);

      expect(response.body.page).toBe(page);
      expect(response.body.size).toBe(size);
      expect(response.body.logs.length).toBeLessThanOrEqual(size);
    });

    it('날짜 범위로 이력을 필터링할 수 있다', async () => {
      const userId = 1;
      const from = '2024-01-01';
      const to = '2024-12-31';

      const response = await request(app.getHttpServer())
        .get(`/api/users/${userId}/balance/logs`)
        .query({ from, to })
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('거래 코드로 이력을 필터링할 수 있다', async () => {
      const userId = 1;
      const code = 'CHARGE';

      const response = await request(app.getHttpServer())
        .get(`/api/users/${userId}/balance/logs`)
        .query({ code })
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('존재하지 않는 사용자의 이력 조회 시 404를 반환한다', async () => {
      const nonExistentUserId = 99999;

      await request(app.getHttpServer())
        .get(`/api/users/${nonExistentUserId}/balance/logs`)
        .expect(404);
    });
  });

  describe('잔액 충전 및 조회 통합 시나리오', () => {
    it('잔액 충전 후 즉시 조회하면 충전된 금액이 반영되어 있다', async () => {
      const userId = 1;

      // 1. 현재 잔액 조회
      const beforeResponse = await request(app.getHttpServer())
        .get(`/api/users/${userId}/balance`)
        .expect(200);
      const beforeBalance = beforeResponse.body.balance;

      // 2. 잔액 충전
      const chargeAmount = 50000;
      const chargeResponse = await request(app.getHttpServer())
        .patch(`/api/users/${userId}/balance`)
        .send({ amount: chargeAmount })
        .expect(200);

      // 3. 충전 후 잔액 조회
      const afterResponse = await request(app.getHttpServer())
        .get(`/api/users/${userId}/balance`)
        .expect(200);
      const afterBalance = afterResponse.body.balance;

      // 4. 검증
      expect(afterBalance).toBe(beforeBalance + chargeAmount);
      expect(chargeResponse.body.balance).toBe(afterBalance);
    });

    it('잔액 충전 후 변경 이력에 충전 기록이 남는다', async () => {
      const userId = 1;
      const chargeAmount = 20000;

      // 1. 잔액 충전
      await request(app.getHttpServer())
        .patch(`/api/users/${userId}/balance`)
        .send({ amount: chargeAmount })
        .expect(200);

      // 2. 변경 이력 조회 (최신 순)
      const logsResponse = await request(app.getHttpServer())
        .get(`/api/users/${userId}/balance/logs`)
        .query({ page: 1, size: 5 })
        .expect(200);

      // 3. 최근 이력에 충전 기록이 있는지 확인
      expect(logsResponse.body.logs.length).toBeGreaterThan(0);
      const latestLog = logsResponse.body.logs[0];
      expect(latestLog.amount).toBe(chargeAmount);
    });
  });
});
