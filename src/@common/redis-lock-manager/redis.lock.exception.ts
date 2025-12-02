// lock wait timeout exception
export class RedisLockWaitTimeoutException extends Error {
  constructor(lockKey: string) {
    super(`Failed to acquire lock within timeout for key: ${lockKey}`);
    this.name = 'RedisLockWaitTimeoutException';
  }
}

// lock ttl extension exception
export class RedisLockTTLExtentionException extends Error {
  constructor(lockKey: string) {
    super(`Failed to extend lock TTL for key: ${lockKey}`);
    this.name = 'RedisLockTTLExtentionException';
  }
}
