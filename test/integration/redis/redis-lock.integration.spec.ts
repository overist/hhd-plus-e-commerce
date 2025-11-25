import { RedisService } from '@common/redis-manager/redis.service';
import { setupRedisForTest, teardownIntegrationTest } from '../setup';

describe('RedisService Lock Integration Tests', () => {
  let redisService: RedisService;

  beforeAll(async () => {
    redisService = await setupRedisForTest();
  }, 60000);

  afterAll(async () => {
    await teardownIntegrationTest();
  });

  beforeEach(async () => {
    // 테스트 간 키 정리
    const client = redisService.getClient();
    const keys = await client.keys('*');
    if (keys.length > 0) {
      await client.del(...keys);
    }
  });

  describe('withLock 동작', () => {
    it('락을 획득하고 해제할 수 있다', async () => {
      // Given
      const lockKey = 'lock:test:basic-lock';

      // When: 락 획득
      const acquired = await redisService.acquireLock(lockKey, 5000);

      // Then
      expect(acquired).toBe(true);

      // When: 락 해제
      await redisService.releaseLock(lockKey);

      // Then: 다시 락 획득 가능
      const acquiredAgain = await redisService.acquireLock(lockKey, 5000);
      expect(acquiredAgain).toBe(true);
    });

    it('이미 획득된 락은 다시 획득할 수 없다', async () => {
      // Given
      const lockKey = 'lock:test:duplicate-lock';
      await redisService.acquireLock(lockKey, 5000);

      // When: 동일 키로 락 획득 시도
      const acquired = await redisService.acquireLock(lockKey, 5000);

      // Then
      expect(acquired).toBe(false);
    });

    it('TTL이 지나면 락이 자동으로 해제된다', async () => {
      // Given
      const lockKey = 'lock:test:ttl-lock';
      await redisService.acquireLock(lockKey, 100); // 100ms TTL

      // When: TTL 대기
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Then: 락 재획득 가능
      const acquired = await redisService.acquireLock(lockKey, 5000);
      expect(acquired).toBe(true);
    });

    it('락 내에서 작업을 실행하고 결과를 반환한다', async () => {
      // Given
      const lockKey = 'lock:test:with-lock';
      let executed = false;

      // When
      const result = await redisService.withLock(lockKey, async () => {
        executed = true;
        return 'success';
      });

      // Then
      expect(executed).toBe(true);
      expect(result).toBe('success');
    });

    it('작업 완료 후 락이 해제된다', async () => {
      // Given
      const lockKey = 'lock:test:release-after-work';

      // When
      await redisService.withLock(lockKey, async () => {
        return 'done';
      });

      // Then: 락이 해제되어 다시 획득 가능
      const acquired = await redisService.acquireLock(lockKey, 5000);
      expect(acquired).toBe(true);
    });

    it('작업 중 에러가 발생해도 락이 해제된다', async () => {
      // Given
      const lockKey = 'lock:test:error-release';

      // When & Then
      await expect(
        redisService.withLock(lockKey, async () => {
          throw new Error('작업 중 에러');
        }),
      ).rejects.toThrow('작업 중 에러');

      // Then: 락이 해제되어 다시 획득 가능
      const acquired = await redisService.acquireLock(lockKey, 5000);
      expect(acquired).toBe(true);
    });
  });

  describe('동시성 제어', () => {
    it('동시에 같은 락을 획득하려는 요청 중 하나만 성공한다', async () => {
      // Given
      const lockKey = 'lock:test:concurrent-lock';
      const results: boolean[] = [];

      // When: 동시에 10개의 락 획득 시도
      const promises = Array.from({ length: 10 }, async () => {
        const acquired = await redisService.acquireLock(lockKey, 5000);
        results.push(acquired);
        return acquired;
      });

      await Promise.all(promises);

      // Then: 정확히 1개만 성공
      const successCount = results.filter((r) => r === true).length;
      expect(successCount).toBe(1);

      // Cleanup
      await redisService.releaseLock(lockKey);
    });

    it('withLock으로 동시 요청을 순차 처리한다', async () => {
      // Given
      const lockKey = 'lock:test:sequential';
      const executionOrder: number[] = [];
      let counter = 0;

      // When: 5개의 동시 요청
      const promises = Array.from({ length: 5 }, async (_, index) => {
        return redisService.withLock(lockKey, async () => {
          const currentValue = ++counter;
          executionOrder.push(index);
          // 작업 시간 시뮬레이션
          await new Promise((resolve) => setTimeout(resolve, 50));
          return currentValue;
        });
      });

      const results = await Promise.all(promises);

      // Then: 모든 요청이 순차적으로 처리됨
      expect(results.sort()).toEqual([1, 2, 3, 4, 5]);
      expect(counter).toBe(5);
    });

    it('서로 다른 키의 락은 동시에 획득 가능하다', async () => {
      // Given
      const lockKey1 = 'lock:test:different-key-1';
      const lockKey2 = 'lock:test:different-key-2';

      // When
      const [acquired1, acquired2] = await Promise.all([
        redisService.acquireLock(lockKey1, 5000),
        redisService.acquireLock(lockKey2, 5000),
      ]);

      // Then: 둘 다 성공
      expect(acquired1).toBe(true);
      expect(acquired2).toBe(true);

      // Cleanup
      await Promise.all([
        redisService.releaseLock(lockKey1),
        redisService.releaseLock(lockKey2),
      ]);
    });
  });

  describe('카운터 동시성 테스트', () => {
    it('락을 사용하면 동시 증가 시에도 정합성이 유지된다', async () => {
      // Given
      let counterWithLock = 0;
      let counterWithNoLock = 0;
      const iterations = 20;
      const lockKey = 'lock:test:counter';

      // When
      // 락을 사용하여 동시에 카운터1 증가
      const promises1 = Array.from({ length: iterations }, async () => {
        return redisService.withLock(lockKey, async () => {
          const current = counterWithLock;
          await new Promise((resolve) => setTimeout(resolve, 1)); // 약간의 지연
          counterWithLock = current + 1;
          return counterWithLock;
        });
      });
      // 락을 사용하지 않고 동시에 카운터2 증가
      const promises2 = Array.from({ length: iterations }, async () => {
        const current = counterWithNoLock;
        await new Promise((resolve) => setTimeout(resolve, 1)); // 약간의 지연
        counterWithNoLock = current + 1;
      });

      await Promise.all(promises1);
      await Promise.all(promises2);

      // Then: 정확히 iterations만큼 증가
      expect(counterWithLock).toBe(iterations);
      expect(counterWithNoLock).toBeLessThan(iterations);
      console.log(
        `락 사용 카운터: ${counterWithLock}, 락 미사용 카운터: ${counterWithNoLock}`,
      );
    }, 30000);
  });
});
