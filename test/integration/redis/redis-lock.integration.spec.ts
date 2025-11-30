import { RedisLockService } from '@common/redis-lock-manager/redis.lock.service';
import { setupRedisForTest, teardownIntegrationTest } from '../setup';

/**
 * Redlock 기반 분산 락 통합 테스트
 * - ioredis + redlock 라이브러리 사용
 * - withLock 메서드를 통한 분산 락 테스트
 */
describe('RedisService Redlock Integration Tests', () => {
  let redisLockService: RedisLockService;

  beforeAll(async () => {
    redisLockService = await setupRedisForTest();
  }, 60000);

  afterAll(async () => {
    await teardownIntegrationTest();
  });

  beforeEach(async () => {
    // 테스트 간 키 정리
    const client = redisLockService.getClient();
    const keys = await client.keys('*');
    if (keys.length > 0) {
      await client.del(...keys);
    }
  });

  describe('withLock 기본 동작', () => {
    it('락 내에서 작업을 실행하고 결과를 반환한다', async () => {
      // Given
      let executed = false;

      // When
      const result = await redisLockService.withLock('test:basic', async () => {
        executed = true;
        return 'success';
      });

      // Then
      expect(executed).toBe(true);
      expect(result).toBe('success');
    });

    it('작업 완료 후 락이 자동으로 해제된다', async () => {
      // Given & When
      await redisLockService.withLock('test:auto-release', async () => {
        return 'done';
      });

      // Then: 락이 해제되어 다시 획득 가능
      let acquiredAgain = false;
      await redisLockService.withLock('test:auto-release', async () => {
        acquiredAgain = true;
      });
      expect(acquiredAgain).toBe(true);
    });

    it('작업 중 에러가 발생해도 락이 해제된다', async () => {
      // When & Then
      await expect(
        redisLockService.withLock('test:error-release', async () => {
          throw new Error('작업 중 에러');
        }),
      ).rejects.toThrow('작업 중 에러');

      // Then: 락이 해제되어 다시 획득 가능
      let acquiredAgain = false;
      await redisLockService.withLock('test:error-release', async () => {
        acquiredAgain = true;
      });
      expect(acquiredAgain).toBe(true);
    });
  });

  describe('동시성 제어', () => {
    it('동시 요청 시 순차적으로 처리된다', async () => {
      // Given
      const executionOrder: number[] = [];
      let counter = 0;

      // When: 5개의 동시 요청
      const promises = Array.from({ length: 5 }, async (_, index) => {
        return redisLockService.withLock('test:sequential', async () => {
          const currentValue = ++counter;
          executionOrder.push(index);
          // 작업 시간 시뮬레이션
          await new Promise((resolve) => setTimeout(resolve, 30));
          return currentValue;
        });
      });

      const results = await Promise.all(promises);

      // Then: 모든 요청이 처리됨 (순서는 보장되지 않지만 결과값은 1~5)
      expect(results.sort()).toEqual([1, 2, 3, 4, 5]);
      expect(counter).toBe(5);
      expect(executionOrder.length).toBe(5);
    });

    it('서로 다른 키의 락은 동시에 획득 가능하다', async () => {
      // Given
      const results: string[] = [];
      const startTime = Date.now();

      // When: 서로 다른 키로 동시 실행
      await Promise.all([
        redisLockService.withLock('test:different-1', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          results.push('key1');
        }),
        redisLockService.withLock('test:different-2', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          results.push('key2');
        }),
      ]);

      const elapsed = Date.now() - startTime;

      // Then: 병렬로 실행되어 총 시간이 150ms 미만
      expect(results).toHaveLength(2);
      expect(elapsed).toBeLessThan(150);
    });
  });

  describe('카운터 동시성 테스트', () => {
    it('락을 사용하면 동시 증가 시에도 정합성이 유지된다', async () => {
      // Given
      let counterWithLock = 0;
      let counterWithNoLock = 0;
      const iterations = 20;

      // When
      // 락을 사용하여 동시에 카운터1 증가
      const promises1 = Array.from({ length: iterations }, async () => {
        return redisLockService.withLock('test:counter', async () => {
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

      // Then: 락 사용 시 정확히 iterations만큼 증가
      expect(counterWithLock).toBe(iterations);
      // 락 미사용 시 레이스 컨디션으로 인해 iterations보다 훨씬 작음
      expect(counterWithNoLock).toBeLessThanOrEqual(iterations);
      console.log(
        `락 사용 카운터: ${counterWithLock}, 락 미사용 카운터: ${counterWithNoLock}`,
      );
    }, 30000);
  });

  describe('Redlock 자동 연장 (automaticExtensionThreshold)', () => {
    it('장시간 작업 시 락이 자동으로 연장된다', async () => {
      // Given: TTL 1초, 작업 시간 2초
      // Redlock의 automaticExtensionThreshold 설정으로 자동 연장됨
      let completed = false;

      // When
      await redisLockService.withLock(
        'test:auto-extend',
        async () => {
          // TTL(1000ms)보다 긴 작업
          await new Promise((resolve) => setTimeout(resolve, 1500));
          completed = true;
          return 'done';
        },
        { ttl: 1000 },
      );

      // Then: 자동 연장으로 작업 완료
      expect(completed).toBe(true);
    }, 10000);

    it('5회 이상 자동 연장이 안정적으로 동작한다', async () => {
      // Given:
      // - TTL: 1000ms
      // - automaticExtensionThreshold: 500ms (TTL 만료 500ms 전에 자동 연장)
      // - 작업 시간: 5500ms (5회 이상 연장 필요)
      // - 예상 연장 횟수: 약 10회 (5500ms / 500ms interval)
      //
      // 핵심 검증:
      // 락 연장이 필요한 시점(TTL 만료 직전)에 다른 클라이언트가 락 획득을 시도해도
      // 절대 획득되지 않아야 함 (자동 연장이 정상 동작하는 증거)

      const lockKey = 'test:multi-extend-strict';
      let mainTaskCompleted = false;
      let lockViolationDetected = false;
      const intrusionAttempts: { attemptTime: number; acquired: boolean }[] =
        [];
      const startTime = Date.now();

      // 동시 실행: 메인 작업 + 주기적 침입 시도
      await Promise.all([
        // 메인 작업: 6초간 락 점유 (TTL 1초, 약 10~12회 연장 필요)
        redisLockService.withLock(
          lockKey,
          async () => {
            // 500ms 간격으로 12회 체크 (총 6초)
            for (let i = 0; i < 12; i++) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
            mainTaskCompleted = true;
            return 'done';
          },
          { ttl: 1000 },
        ),

        // 침입자: 락 연장 타이밍(500ms 간격)에 맞춰 락 획득 시도
        (async () => {
          // 메인 작업이 락을 획득할 시간을 줌
          await new Promise((resolve) => setTimeout(resolve, 100));

          // 6초 동안 500ms 간격으로 락 획득 직접 시도 (Redlock 우회)
          const client = redisLockService.getClient();
          for (let i = 0; i < 12; i++) {
            const attemptTime = Date.now() - startTime;

            // NX 옵션으로 락 획득 시도 (락이 없을 때만 성공)
            const result = await client.set(
              `lock:${lockKey}`,
              'intruder',
              'PX',
              100,
              'NX',
            );

            const acquired = result === 'OK';
            intrusionAttempts.push({ attemptTime, acquired });

            if (acquired) {
              lockViolationDetected = true;
              // 획득에 성공했다면 즉시 삭제 (테스트 진행을 위해)
              await client.del(`lock:${lockKey}`);
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        })(),
      ]);

      const totalElapsed = Date.now() - startTime;

      // Then
      // 1. 메인 작업이 정상 완료되어야 함
      expect(mainTaskCompleted).toBe(true);

      // 2. 6초 이상 작업이 수행됨 (5회 이상 연장됨)
      expect(totalElapsed).toBeGreaterThan(5500);

      // 3. 핵심: 모든 침입 시도가 실패해야 함 (락이 항상 유효했음)
      const successfulIntrusions = intrusionAttempts.filter((a) => a.acquired);
      expect(successfulIntrusions).toHaveLength(0);
      expect(lockViolationDetected).toBe(false);
    }, 15000);
  });

  describe('에러 처리', () => {
    it('중첩된 비동기 작업에서도 에러가 정상적으로 전파된다', async () => {
      // When & Then
      await expect(
        redisLockService.withLock('test:nested-error', async () => {
          return await (async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            throw new Error('중첩된 에러');
          })();
        }),
      ).rejects.toThrow('중첩된 에러');
    });
  });
});
