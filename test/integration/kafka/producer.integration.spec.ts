import { Producer, Consumer } from 'kafkajs';
import {
  setupKafkaForTest,
  createTopicIfNotExists,
  getKafkaProducer,
  getKafkaClient,
  teardownIntegrationTest,
} from '../setup';
import {
  OrderKafkaProducer,
  OrderProcessedMessage,
} from '@/order/infrastructure/order.kafka.producer';

/**
 * Kafka Producer 통합 테스트
 *
 * 실제 Kafka 브로커를 사용한 Producer 통합 테스트
 * 테스트 대상: OrderKafkaProducer - 실제 Producer 클래스의 메시지 발행 검증
 */
describe('Kafka Producer Integration Test', () => {
  let producer: Producer;
  const TOPIC = 'order.processed';

  beforeAll(async () => {
    // Kafka 컨테이너 시작
    await setupKafkaForTest();
    producer = getKafkaProducer();

    // 토픽 생성
    await createTopicIfNotExists(TOPIC);
  }, 120000);

  afterAll(async () => {
    await teardownIntegrationTest();
  }, 30000);

  /**
   * OrderKafkaProducer 통합 테스트
   * 실제 OrderKafkaProducer 클래스를 사용하여 Kafka 메시지 발행 검증
   * Kafka 브로커에서 실제로 메시지를 수신하여 검증
   */
  describe('OrderKafkaProducer', () => {
    let orderKafkaProducer: OrderKafkaProducer;
    let testConsumer: Consumer;

    beforeEach(async () => {
      // 실제 OrderKafkaProducer 인스턴스 생성 (DI된 producer 주입)
      orderKafkaProducer = new OrderKafkaProducer(producer);

      // 검증용 Consumer 생성
      const kafka = getKafkaClient();
      testConsumer = kafka.consumer({ groupId: `test-verify-${Date.now()}` });
      await testConsumer.connect();
    });

    afterEach(async () => {
      await testConsumer?.disconnect();
    });

    it('publishOrderProcessed()가 Kafka 브로커에 메시지를 발행해야 한다', async () => {
      // Given
      const orderId = Date.now();
      const message: OrderProcessedMessage = {
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

      // Consumer 설정 - 메시지 수신 대기
      await testConsumer.subscribe({ topic: TOPIC, fromBeginning: false });

      const receivedPromise = new Promise<OrderProcessedMessage>(
        (resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('메시지 수신 타임아웃')),
            10000,
          );

          testConsumer.run({
            eachMessage: async ({ message: msg }) => {
              const data = JSON.parse(msg.value!.toString());
              if (data.orderId === orderId) {
                clearTimeout(timeout);
                resolve(data);
              }
            },
          });
        },
      );

      // Consumer가 준비될 때까지 대기
      await new Promise((r) => setTimeout(r, 1000));

      // When: 실제 OrderKafkaProducer로 메시지 발행
      await orderKafkaProducer.publishOrderProcessed(message);

      // Then: Kafka 브로커에서 메시지 수신 확인
      const receivedMessage = await receivedPromise;

      expect(receivedMessage.orderId).toBe(orderId);
      expect(receivedMessage.userId).toBe(1);
      expect(receivedMessage.finalAmount).toBe(50000);
      expect(receivedMessage.items[0].productName).toBe('테스트 상품');
    }, 30000);

    it('여러 메시지를 발행하면 Kafka 브로커에서 모두 수신되어야 한다', async () => {
      // Given
      const baseOrderId = Date.now();
      const messages: OrderProcessedMessage[] = [
        {
          orderId: baseOrderId,
          userId: 1,
          finalAmount: 10000,
          couponId: null,
          items: [
            {
              productOptionId: 1,
              productName: '상품1',
              quantity: 1,
              price: 10000,
            },
          ],
          processedAt: new Date().toISOString(),
        },
        {
          orderId: baseOrderId + 1,
          userId: 2,
          finalAmount: 20000,
          couponId: 5,
          items: [
            {
              productOptionId: 2,
              productName: '상품2',
              quantity: 2,
              price: 10000,
            },
          ],
          processedAt: new Date().toISOString(),
        },
      ];

      const targetOrderIds = new Set(messages.map((m) => m.orderId));

      // Consumer 설정
      await testConsumer.subscribe({ topic: TOPIC, fromBeginning: false });

      const receivedMessages: OrderProcessedMessage[] = [];
      const receivedPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () =>
            reject(
              new Error(
                `메시지 수신 타임아웃: ${receivedMessages.length}/2 수신됨`,
              ),
            ),
          10000,
        );

        testConsumer.run({
          eachMessage: async ({ message: msg }) => {
            const data = JSON.parse(msg.value!.toString());
            if (targetOrderIds.has(data.orderId)) {
              receivedMessages.push(data);
              if (receivedMessages.length >= 2) {
                clearTimeout(timeout);
                resolve();
              }
            }
          },
        });
      });

      // Consumer가 준비될 때까지 대기
      await new Promise((r) => setTimeout(r, 1000));

      // When: 여러 메시지 발행
      for (const msg of messages) {
        await orderKafkaProducer.publishOrderProcessed(msg);
      }

      // Then: Kafka 브로커에서 모든 메시지 수신 확인
      await receivedPromise;

      expect(receivedMessages).toHaveLength(2);
      expect(receivedMessages.map((m) => m.orderId).sort()).toEqual(
        [baseOrderId, baseOrderId + 1].sort(),
      );
    }, 30000);
  });
});
