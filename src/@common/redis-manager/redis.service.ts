import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis 서비스
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  /**
   * 일반 명령용 Redis 클라이언트
   */
  getClient(): Redis {
    return this.client;
  }
}
