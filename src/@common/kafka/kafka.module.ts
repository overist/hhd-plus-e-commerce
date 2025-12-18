import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { type Producer } from 'kafkajs';
import { getKafkaClient } from './kafka.config';

export const KAFKA_PRODUCER = Symbol('KAFKA_PRODUCER');

/**
 * Kafka Producer 제공
 */
@Global()
@Module({
  providers: [
    {
      provide: KAFKA_PRODUCER,
      useFactory: async () => {
        const producer = getKafkaClient().producer();
        await producer.connect();
        return producer;
      },
    },
  ],
  exports: [KAFKA_PRODUCER],
})
export class GlobalKafkaModule implements OnApplicationShutdown {
  constructor(@Inject(KAFKA_PRODUCER) private readonly producer: Producer) {}

  async onApplicationShutdown() {
    await this.producer.disconnect();
  }
}
