// lock wait timeout exception
export class RedisLockWaitTimeoutException extends Error {
  constructor(lockKey: string) {
    super(`Failed to acquire lock within timeout for key: ${lockKey}`);
    this.name = 'RedisLockWaitTimeoutException';
  }
}
