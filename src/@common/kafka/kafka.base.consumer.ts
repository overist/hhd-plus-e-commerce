import {
  Injectable,
  OnModuleInit,
  OnApplicationShutdown,
  Logger,
} from '@nestjs/common';
import { Consumer, EachMessagePayload } from 'kafkajs';
import { getKafkaClient } from './kafka.config';

/**
 * Kafka Consumer 베이스 클래스 (상속용)
 * - topic: 구독할 토픽 이름
 * - groupId: 컨슈머 그룹 아이디
 * - handleMessage: 메시지 처리 로직 콜백
 */
@Injectable()
export abstract class KafkaBaseConsumer
  implements OnModuleInit, OnApplicationShutdown
{
  protected readonly logger = new Logger(this.constructor.name);
  private consumer: Consumer;

  abstract readonly topic: string;
  abstract readonly groupId: string;
  abstract handleMessage(payload: EachMessagePayload): Promise<void>;

  async onModuleInit() {
    const kafka = getKafkaClient();
    this.consumer = kafka.consumer({ groupId: this.groupId });

    // Default: false, Test: true
    const fromBeginning = process.env.NODE_ENV === 'test';

    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topic: this.topic,
        fromBeginning,
      });

      await this.consumer.run({
        eachMessage: async (payload) => {
          try {
            await this.handleMessage(payload);
          } catch (error) {
            this.logger.error(
              `[Kafka] 메시지 처리 실패 - topic: ${this.topic}, offset: ${payload.message.offset}`,
              error,
            );
          }
        },
      });

      this.logger.log(`[Kafka] Consumer 시작 - topic: ${this.topic}`);
    } catch (error) {
      this.logger.error(
        `[Kafka] Consumer 초기화 실패 - topic: ${this.topic}`,
        error,
      );
    }
  }

  async onApplicationShutdown() {
    await this.consumer?.disconnect();
  }
}
