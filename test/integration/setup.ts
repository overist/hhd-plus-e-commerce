import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { execSync } from 'child_process';
import * as path from 'path';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import { RedisService } from '@common/redis-manager/redis.service';
import { createClient } from 'redis';

let mysqlContainer: StartedMySqlContainer;
let redisContainer: StartedRedisContainer;
let prismaService: PrismaService;
let redisService: RedisService;

/**
 * 모든 통합 테스트 시작 전 한 번만 실행
 * MySQL 컨테이너를 시작하고 Prisma 마이그레이션 실행
 */
export async function setupDatabaseTest(): Promise<PrismaService> {
  if (!mysqlContainer) {
    // MySQL 컨테이너 시작
    mysqlContainer = await new MySqlContainer('mysql:8.0')
      .withDatabase('ecommerce_db')
      .withUsername('test')
      .withUserPassword('test')
      .withRootPassword('test1234!')
      .withEnvironment({
        MYSQL_ROOT_PASSWORD: 'test1234!',
        MYSQL_DATABASE: 'ecommerce_db',
        MYSQL_USER: 'test',
        MYSQL_PASSWORD: 'test',
        TZ: 'UTC',
      })
      .withCommand([
        'mysqld',
        '--character-set-server=utf8mb4',
        '--collation-server=utf8mb4_unicode_ci',
        '--default-authentication-plugin=mysql_native_password',
      ])
      .withTmpFs({ '/var/lib/mysql': 'rw' })
      .start();

    // DATABASE_URL 환경 변수 설정
    const databaseUrl = `mysql://test:test@${mysqlContainer.getHost()}:${mysqlContainer.getPort()}/ecommerce_db`;
    process.env.DATABASE_URL = databaseUrl;

    // PrismaService 인스턴스 생성
    prismaService = new PrismaService({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    await prismaService.$connect();

    // Prisma schema를 사용하여 테이블 생성
    try {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');

      // prisma db push를 실행하여 스키마를 데이터베이스에 적용
      execSync(`npx prisma db push --skip-generate --schema=${schemaPath}`, {
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'ignore', // 출력 숨김
      });

      console.log('✅ MySQL 컨테이너 시작 및 스키마 초기화 완료');
    } catch (error) {
      console.error('❌ 스키마 초기화 실패:', error.message);
      throw error;
    }
  }

  return prismaService;
}

/**
 * Redis 컨테이너를 시작하고 RedisService를 반환
 */
export async function setupRedisForTest(): Promise<RedisService> {
  if (!redisContainer) {
    // Redis 컨테이너 시작
    redisContainer = await new RedisContainer('redis:8.4.0').start();

    const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getPort()}`;
    process.env.REDIS_URL = redisUrl;

    // RedisService 인스턴스 생성 및 클라이언트 주입
    redisService = new RedisService();
    const redisClient = createClient({ url: redisUrl });
    await redisClient.connect();
    (redisService as any).client = redisClient;

    console.log('✅ Redis 컨테이너 시작 완료');
  }

  return redisService;
}

/**
 * RedisService 인스턴스 반환
 */
export function getRedisService(): RedisService {
  return redisService;
}

/**
 * 각 테스트 후 데이터 정리
 */
export async function cleanupDatabase(prisma: PrismaService): Promise<void> {
  // 외래 키 체크를 비활성화하고 모든 테이블 데이터 삭제
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;

  // 모든 테이블의 데이터 삭제
  const tables = [
    'transaction_out_failure_log',
    'product_popularity_snapshot',
    'user_coupons',
    'order_items',
    'orders',
    'coupons',
    'cart_items',
    'product_options',
    'products',
    'user_balance_change_log',
    'users',
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${table}`);
    } catch (error) {
      console.warn(`테이블 정리 경고 (${table}): ${error.message}`);
    }
  }

  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;
}

/**
 * 모든 통합 테스트 종료 후 한 번만 실행
 */
export async function teardownIntegrationTest(): Promise<void> {
  if (prismaService) {
    await prismaService.$disconnect();
  }

  if (redisService) {
    const client = redisService.getClient();
    if (client) {
      await client.quit();
    }
  }

  if (mysqlContainer) {
    await mysqlContainer.stop();
    console.log('✅ MySQL 컨테이너 종료 완료');
  }

  if (redisContainer) {
    await redisContainer.stop();
    console.log('✅ Redis 컨테이너 종료 완료');
  }
}
