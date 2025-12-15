import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import session from 'express-session';
import { AppModule } from '../../src/app.module';
import { DomainExceptionFilter } from '@common/exception/domain-exception.filter';
import { ApplicationExceptionFilter } from '@common/exception/application-exception.filter';

describe('AuthController (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(
      session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 60000 },
      }),
    );
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

  describe('POST /api/auth/signup', () => {
    it.skip('회원가입이 정상적으로 동작한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .expect(201);

      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('balance', 0);
    });
  });

  describe('POST /api/auth/login', () => {
    it.skip('로그인이 정상적으로 동작한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ userId: 1 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('userId', 1);
    });

    it.skip('존재하지 않는 사용자로 로그인 시 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ userId: 999999 })
        .expect(400);
    });
  });
});
