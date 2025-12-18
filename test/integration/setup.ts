import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';
import { execSync } from 'child_process';
import * as path from 'path';
import { Kafka, Producer, Consumer, Admin, logLevel } from 'kafkajs';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import { RedisLockService } from '@common/redis-lock-manager/redis.lock.service';
import { RedisService } from '@common/redis/redis.service';

let mysqlContainer: StartedMySqlContainer;
let redisContainer: StartedRedisContainer;
let kafkaContainer: StartedKafkaContainer;
let prismaService: PrismaService;
let redisLockService: RedisLockService;
let redisService: RedisService;
let kafkaClient: Kafka;
let kafkaProducer: Producer;
let kafkaAdmin: Admin;

const KAFKA_PORT = 9093;

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
 * Redis 컨테이너를 시작하고 redisLockService를 반환
 */
export async function setupRedisForTest(): Promise<RedisLockService> {
  if (!redisContainer) {
    // Redis 컨테이너 시작
    redisContainer = await new RedisContainer('redis:8.4.0').start();

    const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getPort()}`;
    process.env.REDIS_URL = redisUrl;

    // redisLockService 인스턴스 생성 및 onModuleInit 호출
    redisLockService = new RedisLockService();
    await redisLockService.onModuleInit();

    // redisService 인스턴스 생성 및 onModuleInit 호출
    redisService = new RedisService();
    await redisService.onModuleInit();

    console.log('✅ Redis 컨테이너 시작 완료 (ioredis + Redlock)');
  }

  return redisLockService;
}

/**
 * redisLockService 인스턴스 반환
 */
export function getRedisLockService(): RedisLockService {
  return redisLockService;
}

/**
 * redisService 인스턴스 반환
 */
export function getRedisService(): RedisService {
  return redisService;
}

/**
 * Kafka 컨테이너 시작 및 클라이언트 초기화
 * - testcontainers/kafka는 Confluent Platform 이미지 사용
 * - KRaft 모드는 7.0.0 이상 필요
 */
export async function setupKafkaForTest(): Promise<{
  kafkaClient: Kafka;
  producer: Producer;
  admin: Admin;
}> {
  if (!kafkaContainer) {
    console.log('🚀 Kafka 컨테이너 시작 중...');

    // Confluent Platform 이미지 (KRaft 모드, 7.5.0)
    kafkaContainer = await new KafkaContainer('confluentinc/cp-kafka:7.5.0')
      .withKraft()
      .start();

    // 브로커 주소 얻기 (testcontainers가 노출한 포트 사용)
    const host = kafkaContainer.getHost();
    const mappedPort = kafkaContainer.getMappedPort(KAFKA_PORT);
    const brokers = [`${host}:${mappedPort}`];

    console.log(`📍 Kafka 브로커 주소: ${brokers[0]}`);

    process.env.KAFKA_BROKERS = brokers[0];
    process.env.KAFKA_CLIENT_ID = 'test-client';

    // Kafka 클라이언트 생성 (로그 레벨 최소화)
    kafkaClient = new Kafka({
      clientId: 'test-client',
      brokers,
      logLevel: logLevel.ERROR,
    });

    // Admin 클라이언트 연결
    kafkaAdmin = kafkaClient.admin();
    await kafkaAdmin.connect();

    // Producer 연결
    kafkaProducer = kafkaClient.producer();
    await kafkaProducer.connect();

    console.log(`✅ Kafka 컨테이너 시작 완료 - brokers: ${brokers.join(',')}`);
  }

  return { kafkaClient, producer: kafkaProducer, admin: kafkaAdmin };
}

/**
 * Kafka 클라이언트 반환
 */
export function getKafkaClient(): Kafka {
  return kafkaClient;
}

/**
 * Kafka Producer 반환
 */
export function getKafkaProducer(): Producer {
  return kafkaProducer;
}

/**
 * Kafka Admin 반환
 */
export function getKafkaAdmin(): Admin {
  return kafkaAdmin;
}

/**
 * Kafka 토픽 생성 (없으면)
 */
export async function createTopicIfNotExists(
  topic: string,
  numPartitions = 1,
): Promise<void> {
  const topics = await kafkaAdmin.listTopics();
  if (!topics.includes(topic)) {
    await kafkaAdmin.createTopics({
      topics: [{ topic, numPartitions }],
    });
    console.log(`📝 토픽 생성됨: ${topic}`);
  }
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
  // Redis 클라이언트를 먼저 정리 (컨테이너 종료 전에 클라이언트 연결 해제)
  // disconnect()로 강제 종료하여 pending 요청이 있어도 즉시 종료
  if (redisLockService) {
    try {
      const client = redisLockService.getClient();
      const subscriber = redisLockService.getSubscriber();
      if (subscriber) {
        subscriber.removeAllListeners('error');
        await subscriber.quit().catch(() => {});
      }
      if (client) {
        client.removeAllListeners('error');
        await client.quit().catch(() => {});
      }
    } catch {
      // 이미 연결이 끊어진 경우 무시
    }
    redisLockService = null as any;
  }

  // redisService 정리
  if (redisService) {
    try {
      const client = redisService.getClient();
      if (client) {
        client.removeAllListeners('error'); // 에러 이벤트 제거
        await client.quit().catch(() => {}); // quit 실패 무시
      }
    } catch {
      // 이미 연결이 끊어진 경우 무시
    }
    redisService = null as any;
  }

  if (prismaService) {
    await prismaService.$disconnect();
  }

  if (mysqlContainer) {
    await mysqlContainer.stop();
    console.log('✅ MySQL 컨테이너 종료 완료');
  }

  if (redisContainer) {
    await redisContainer.stop();
    console.log('✅ Redis 컨테이너 종료 완료');
    redisContainer = null as any;
  }

  // Kafka 정리
  if (kafkaProducer) {
    await kafkaProducer.disconnect().catch(() => {});
    kafkaProducer = null as any;
  }

  if (kafkaAdmin) {
    await kafkaAdmin.disconnect().catch(() => {});
    kafkaAdmin = null as any;
  }

  kafkaClient = null as any;

  if (kafkaContainer) {
    await kafkaContainer.stop();
    console.log('✅ Kafka 컨테이너 종료 완료');
    kafkaContainer = null as any;
  }
}
