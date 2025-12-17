import {
  setupRedisForTest,
  getRedisService,
  teardownIntegrationTest,
} from '../setup';
import { ExternalPlatformKafkaConsumer } from '@/order/presentation/consumers/external-platform.kafka.consumer';
import { OrderProcessedMessage } from '@/order/infrastructure/order.kafka.producer';
import { RedisService } from '@common/redis/redis.service';

/**
 * Kafka Consumer 통합 테스트
 *
 * 실제 Redis 컨테이너를 사용한 Consumer 통합 테스트
 * 테스트 대상: ExternalPlatformKafkaConsumer.handleMessage() - Consumer의 메시지 처리 로직 검증
 */
describe('Kafka Consumer Integration Test', () => {
  let redisService: RedisService;
  const TOPIC = 'order.processed';
  const REDIS_KEY_PREFIX = 'data:order:processed:';

  beforeAll(async () => {
    // Redis 컨테이너 시작
    await setupRedisForTest();
    redisService = getRedisService();
  }, 120000);

  afterAll(async () => {
    await teardownIntegrationTest();
  }, 30000);

  beforeEach(async () => {
    // Redis 데이터 정리
    const redis = redisService.getClient();
    const keys = await redis.keys(`${REDIS_KEY_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  // TODO 데모앱이라 모킹 없이 실제로 검증합니다. 실제 환경에서는 외부플랫폼을 도커로 띄우는 방안을 고려해야 함.
  describe('ExternalPlatformKafkaConsumer (CF: No Mock!!!!!!)', () => {
    let consumer: ExternalPlatformKafkaConsumer;

    beforeEach(() => {
      // 실제 ExternalPlatformKafkaConsumer 인스턴스 생성
      consumer = new ExternalPlatformKafkaConsumer(redisService);
    });

    it('handleMessage()가 주문 데이터를 로컬 Redis에 저장해야 한다', async () => {
      // Given
      const orderId = Date.now();
      const orderMessage: OrderProcessedMessage = {
        orderId,
        userId: 1,
        finalAmount: 50000,
        couponId: null,
        items: [
          {
            productOptionId: 1,
            productName: '테스트 상품',
            quantity: 2,
            price: 25000,
          },
        ],
        processedAt: new Date().toISOString(),
      };

      // When: 실제 handleMessage() 호출
      await consumer.handleMessage({
        topic: TOPIC,
        partition: 0,
        message: {
          key: Buffer.from(String(orderId)),
          value: Buffer.from(JSON.stringify(orderMessage)),
          timestamp: String(Date.now()),
          attributes: 0,
          offset: '0',
          size: 0,
        },
        heartbeat: async () => {},
        pause: () => () => {},
      });

      // Then: Redis에 저장 확인
      const redis = redisService.getClient();
      const savedData = await redis.get(`${REDIS_KEY_PREFIX}${orderId}`);

      expect(savedData).not.toBeNull();
      const parsedData = JSON.parse(savedData!);
      expect(parsedData.orderId).toBe(orderId);
    });

    it('여러 상품이 포함된 주문 데이터를 로컬 Redis에 저장해야 한다', async () => {
      // Given
      const orderId = Date.now();
      const orderMessage: OrderProcessedMessage = {
        orderId,
        userId: 3,
        finalAmount: 100000,
        couponId: null,
        items: [
          {
            productOptionId: 1,
            productName: '상품A',
            quantity: 1,
            price: 30000,
          },
          {
            productOptionId: 2,
            productName: '상품B',
            quantity: 2,
            price: 20000,
          },
          {
            productOptionId: 3,
            productName: '상품C',
            quantity: 1,
            price: 30000,
          },
        ],
        processedAt: new Date().toISOString(),
      };

      // When
      await consumer.handleMessage({
        topic: TOPIC,
        partition: 0,
        message: {
          key: Buffer.from(String(orderId)),
          value: Buffer.from(JSON.stringify(orderMessage)),
          timestamp: String(Date.now()),
          attributes: 0,
          offset: '0',
          size: 0,
        },
        heartbeat: async () => {},
        pause: () => () => {},
      });

      // Then
      const redis = redisService.getClient();
      const savedData = await redis.get(`${REDIS_KEY_PREFIX}${orderId}`);
      const parsedData = JSON.parse(savedData!);

      expect(parsedData.items).toHaveLength(3);
      expect(parsedData.items.map((i: any) => i.productName)).toEqual([
        '상품A',
        '상품B',
        '상품C',
      ]);
    });
  });
});
