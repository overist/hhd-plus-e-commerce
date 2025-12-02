import { RedisLockService } from '@common/redis-lock-manager/redis.lock.service';
import { RedisLockTTLExtentionException } from '@common/redis-lock-manager/redis.lock.exception';

describe('RedisLockService', () => {
  let redisLockService: RedisLockService;
  let mockClient: any;
  let mockSubscriber: any;

  beforeEach(() => {
    redisLockService = new RedisLockService();

    // Mock Redis client
    mockClient = {
      set: jest.fn(),
      eval: jest.fn(),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
    };

    // Mock Redis subscriber
    mockSubscriber = {
      on: jest.fn(),
      off: jest.fn(),
      psubscribe: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      setMaxListeners: jest.fn(),
    };

    // Mock 주입
    (redisLockService as any).client = mockClient;
    (redisLockService as any).subscriber = mockSubscriber;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('withLock', () => {
    it('락 획득 후 작업을 실행하고 결과를 반환한다', async () => {
      // Given
      const mockFn = jest.fn().mockResolvedValue('result');
      mockClient.set.mockResolvedValue('OK'); // 락 획득 성공
      mockClient.eval.mockResolvedValue(1); // 락 해제 성공

      // When
      const result = await redisLockService.withLock('test-key', mockFn);

      // Then
      expect(result).toBe('result');
      expect(mockClient.set).toHaveBeenCalledWith(
        'lock:test-key',
        expect.any(String), // UUID token
        'PX',
        5000,
        'NX',
      );
      expect(mockFn).toHaveBeenCalled();
      expect(mockClient.eval).toHaveBeenCalled(); // 락 해제
    });

    it('작업 중 에러가 발생하면 에러를 전파한다', async () => {
      // Given
      const mockFn = jest.fn().mockRejectedValue(new Error('작업 실패'));
      mockClient.set.mockResolvedValue('OK');
      mockClient.eval.mockResolvedValue(1);

      // When & Then
      await expect(
        redisLockService.withLock('test-key', mockFn),
      ).rejects.toThrow('작업 실패');

      // 에러가 발생해도 락은 해제되어야 함
      expect(mockClient.eval).toHaveBeenCalled();
    });
  });
});
