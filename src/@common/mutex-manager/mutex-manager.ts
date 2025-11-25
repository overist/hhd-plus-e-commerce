import { Mutex } from 'async-mutex';

/**
 * Mutex 관리 헬퍼 클래스
 * ID별로 Mutex를 관리하고 자동으로 정리합니다.
 */
export class MutexManager {
  private readonly mutexStorage: Map<number, Mutex> = new Map();

  /**
   * ID에 대한 Mutex를 획득하고 unlock 함수를 반환합니다.
   * @param id - Mutex를 획득할 대상 ID
   * @returns unlock 함수
   */
  async acquire(id: number): Promise<() => void> {
    const mutex = this.getOrCreateMutex(id);
    const unlock = await mutex.acquire();

    return () => {
      unlock();
      this.cleanupMutex(id);
    };
  }

  /**
   * ID에 대한 Mutex를 가져오거나 생성합니다.
   */
  private getOrCreateMutex(id: number): Mutex {
    if (!this.mutexStorage.has(id)) {
      this.mutexStorage.set(id, new Mutex());
    }
    return this.mutexStorage.get(id)!;
  }

  /**
   * 락이 해제된 Mutex를 메모리에서 제거합니다.
   */
  private cleanupMutex(id: number): void {
    const mutex = this.mutexStorage.get(id);
    if (mutex && !mutex.isLocked()) {
      this.mutexStorage.delete(id);
    }
  }
}
