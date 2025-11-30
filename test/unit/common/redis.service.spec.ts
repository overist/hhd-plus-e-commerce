import { RedisLockService } from '@common/redis-lock-manager/redis.lock.service';
import Redlock from 'redlock';

describe('redisLockService', () => {
  let redisLockService: RedisLockService;
  let mockRedlock: jest.Mocked<Redlock>;

  beforeEach(() => {
    // redisLockService 인스턴스 생성
    redisLockService = new RedisLockService();
    // Mock Redlock 생성
    mockRedlock = {
      using: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
    } as unknown as jest.Mocked<Redlock>;

    // Mock Redlock 주입
    (redisLockService as any).redlock = mockRedlock;
    // Mock Redis clients (subscriber/publisher/client) to avoid real network calls
    (redisLockService as any).subscriber = {
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      removeListener: jest.fn(),
      setMaxListeners: jest.fn(),
    } as any;
    (redisLockService as any).publisher = {
      publish: jest.fn().mockResolvedValue(1),
      on: jest.fn(),
    } as any;
    (redisLockService as any).client = { on: jest.fn() } as any;
  });

  describe('withLock', () => {
    it('락 획득 후 작업을 실행하고 결과를 반환한다', async () => {
      // Given
      const mockFn = jest.fn().mockResolvedValue('result');
      mockRedlock.using.mockImplementation(async (_keys, _ttl, fn) => {
        const signal = { aborted: false } as any;
        return fn(signal);
      });

      // When
      const result = await redisLockService.withLock('test-key', mockFn);

      // Then
      expect(result).toBe('result');
      expect(mockRedlock.using).toHaveBeenCalledWith(
        ['lock:test-key'],
        5000,
        expect.any(Function),
      );
      expect(mockFn).toHaveBeenCalled();
    });

    it('작업 중 에러가 발생하면 에러를 전파한다', async () => {
      // Given
      const mockFn = jest.fn().mockRejectedValue(new Error('작업 실패'));
      mockRedlock.using.mockImplementation(async (_keys, _ttl, fn) => {
        const signal = { aborted: false } as any;
        return fn(signal);
      });

      // When & Then
      await expect(
        redisLockService.withLock('test-key', mockFn),
      ).rejects.toThrow('작업 실패');
    });

    it('락이 만료되면 에러를 던진다', async () => {
      // Given
      const mockFn = jest.fn().mockResolvedValue('result');
      mockRedlock.using.mockImplementation(async (_keys, _ttl, fn) => {
        const signal = { aborted: true } as any; // 락 만료 시뮬레이션
        return fn(signal);
      });

      // When & Then
      await expect(
        redisLockService.withLock('test-key', mockFn),
      ).rejects.toThrow('Lock expired for key: lock:test-key');
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('Redlock이 락 획득에 실패하면 에러를 전파한다', async () => {
      // Given
      const mockFn = jest.fn().mockResolvedValue('result');
      mockRedlock.using.mockRejectedValue(
        new Error('The operation was unable to achieve a quorum'),
      );

      // When & Then
      await expect(
        redisLockService.withLock('test-key', mockFn),
      ).rejects.toThrow('The operation was unable to achieve a quorum');
      expect(mockFn).not.toHaveBeenCalled();
    });
  });
});
