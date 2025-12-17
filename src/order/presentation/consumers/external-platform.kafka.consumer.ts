import { Injectable, Logger } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaBaseConsumer } from '@common/kafka/kafka.base.consumer';
import { RedisService } from '@common/redis/redis.service';

export interface OrderProcessedMessage {
  orderId: number;
  userId: number;
  finalAmount: number;
  couponId: number | null;
  items: {
    productOptionId: number;
    productName: string;
    quantity: number;
    price: number;
  }[];
  processedAt: string;
}

/**
 * 외부 데이터 플랫폼 Consumer
 * - Demo 구현 : Kafka에서 주문 완료 메시지를 소비하여 직접적인 부하를 분산하여 Redis에 저장
 * - 실제 환경에서는 그룹을 늘려 무거운 쓰기 작업을 컨슈머별 재처리(분산 처리) 가능
 */
@Injectable()
export class ExternalPlatformKafkaConsumer extends KafkaBaseConsumer {
  protected readonly logger = new Logger(ExternalPlatformKafkaConsumer.name);

  readonly REDIS_KEY_PREFIX = 'data:order:processed:';
  readonly topic = 'order.processed';
  readonly groupId = 'external-platform-redis-group';

  constructor(private readonly redisService: RedisService) {
    super();
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { message } = payload;
    const data: OrderProcessedMessage = JSON.parse(message.value!.toString());

    this.logger.log(`[외부플랫폼] 주문 데이터 수신 - orderId: ${data.orderId}`);

    try {
      const redis = this.redisService.getClient();
      const key = `${this.REDIS_KEY_PREFIX}${data.orderId}`;

      // Redis에 TTL 1시간으로 저장
      await redis.setex(key, 3600, JSON.stringify(data));

      this.logger.log(
        `[외부플랫폼] 주문 데이터 Redis 저장 완료 - key: ${key}, TTL: 3600s`,
      );
    } catch (error) {
      this.logger.error(
        `[외부플랫폼] 주문 데이터 Redis 저장 실패 - orderId: ${data.orderId}`,
        error,
      );
      throw error;
    }
  }
}
