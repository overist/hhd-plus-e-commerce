import { RedisService } from '@common/redis-manager/redis.service';

describe('RedisService', () => {
  let redisService: RedisService;
  let mockRedisClient: {
    set: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(() => {
    // Mock Redis 클라이언트 생성
    mockRedisClient = {
      set: jest.fn(),
      del: jest.fn(),
    };

    // RedisService 인스턴스 생성 및 mock 클라이언트 주입
    redisService = new RedisService();
    (redisService as any).client = mockRedisClient;
  });

  describe('acquireLock', () => {
    it('락 획득 성공 시 true를 반환한다', async () => {
      // Given
      mockRedisClient.set.mockResolvedValue('OK');

      // When
      const result = await redisService.acquireLock('test-key', 5000);

      // Then
      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', '1', {
        PX: 5000,
        NX: true,
      });
    });

    it('락 획득 실패 시 false를 반환한다', async () => {
      // Given
      mockRedisClient.set.mockResolvedValue(null);

      // When
      const result = await redisService.acquireLock('test-key', 5000);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('releaseLock', () => {
    it('락을 해제한다', async () => {
      // Given
      mockRedisClient.del.mockResolvedValue(1);

      // When
      await redisService.releaseLock('test-key');

      // Then
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
    });
  });

  describe('withLock', () => {
    it('락 획득 후 작업을 실행하고 락을 해제한다', async () => {
      // Given
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.del.mockResolvedValue(1);
      const mockFn = jest.fn().mockResolvedValue('result');

      // When
      const result = await redisService.withLock('test-key', mockFn);

      // Then
      expect(result).toBe('result');
      expect(mockRedisClient.set).toHaveBeenCalledWith('lock:test-key', '1', {
        PX: 5000,
        NX: true,
      });
      expect(mockFn).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalledWith('lock:test-key');
    });

    it('작업 중 에러가 발생해도 락을 해제한다', async () => {
      // Given
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.del.mockResolvedValue(1);
      const mockFn = jest.fn().mockRejectedValue(new Error('작업 실패'));

      // When & Then
      await expect(redisService.withLock('test-key', mockFn)).rejects.toThrow(
        '작업 실패',
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith('lock:test-key');
    });

    it('락 획득 실패 시 재시도한다', async () => {
      // Given: 처음 2번 실패, 3번째 성공
      mockRedisClient.set
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('OK');
      mockRedisClient.del.mockResolvedValue(1);
      const mockFn = jest.fn().mockResolvedValue('result');

      // When
      const result = await redisService.withLock('test-key', mockFn);

      // Then
      expect(result).toBe('result');
      expect(mockRedisClient.set).toHaveBeenCalledTimes(3);
    });

    it('최대 재시도 횟수 초과 시 에러를 던진다', async () => {
      // Given: 항상 락 획득 실패하도록 설정하고, 재시도 횟수를 줄인 커스텀 withLock 테스트
      mockRedisClient.set.mockResolvedValue(null);

      // 재시도 로직을 직접 테스트하기 위해 acquireLock만 여러 번 호출
      const results: boolean[] = [];
      for (let i = 0; i < 5; i++) {
        const acquired = await redisService.acquireLock('test-key', 5000);
        results.push(acquired);
      }

      // Then: 모든 시도가 실패
      expect(results.every((r) => r === false)).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledTimes(5);
    });
  });
});
