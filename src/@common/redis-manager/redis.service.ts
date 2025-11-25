import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

/**
 * Redis 서비스
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;

  async onModuleInit(): Promise<void> {
    this.client = createClient({
      url: process.env.REDIS_URL as string,
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis Client Error', err);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis Client Connected');
    });

    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis Client Disconnected');
    }
  }

  /**
   * 일반 명령용 Redis 클라이언트
   */
  getClient(): RedisClientType {
    return this.client;
  }

  /**
   * Simple Lock 획득
   * @param key 락 키
   * @param ttl 락 만료 시간 (밀리초)
   * @returns 락 획득 성공 여부
   */
  async acquireLock(key: string, ttl: number = 5000): Promise<boolean> {
    const result = await this.client.set(key, '1', {
      PX: ttl,
      NX: true,
    });
    return result === 'OK';
  }

  /**
   * Simple Lock 해제
   * @param key 락 키
   */
  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Simple Lock을 사용하여 작업 실행
   * @param key 락 키
   * @param fn 실행할 작업
   * @param ttl 락 만료 시간 (ms)
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = 5000,
  ): Promise<T> {
    const lockKey = `lock:${key}`;

    // 최대 100회 재시도 (Spin Lock)
    for (let i = 0; i < 100; i++) {
      const acquired = await this.acquireLock(lockKey, ttl);
      if (acquired) {
        try {
          return await fn();
        } finally {
          await this.releaseLock(lockKey);
        }
      }

      // 0.02초 대기
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    throw new Error(`Failed to acquire lock for key: ${key}`);
  }
}
