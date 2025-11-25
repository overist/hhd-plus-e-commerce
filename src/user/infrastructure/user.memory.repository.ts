import { Injectable } from '@nestjs/common';
import { MutexManager } from '@common/mutex-manager/mutex-manager';
import {
  IUserBalanceChangeLogRepository,
  IUserRepository,
} from '../domain/interfaces/user.repository.interface';
import { User } from '../domain/entities/user.entity';
import { UserBalanceChangeLog } from '../domain/entities/user-balance-change-log.entity';

/**
 * User Repository Implementation (In-Memory)
 * 동시성 제어: 사용자별 잔액 변경 시 Mutex를 통한 직렬화 보장
 */
@Injectable()
export class UserMemoryRepository implements IUserRepository {
  private users: Map<number, User> = new Map();
  private currentId = 1;
  private readonly mutexManager = new MutexManager();

  // ANCHOR user.findById
  async findById(id: number): Promise<User | null> {
    return this.users.get(id) || null;
  }

  // ANCHOR user.create
  async create(user: User): Promise<User> {
    const unlock = await this.mutexManager.acquire(0);

    try {
      const newUser = new User(
        this.currentId++,
        user.balance,
        user.createdAt,
        user.updatedAt,
      );
      this.users.set(newUser.id, newUser);
      return newUser;
    } finally {
      unlock();
    }
  }

  // ANCHOR user.update
  async update(user: User): Promise<User> {
    const unlock = await this.mutexManager.acquire(user.id);

    try {
      this.users.set(user.id, user);
      return user;
    } finally {
      unlock();
    }
  }
}

/**
 * UserBalanceChangeLog Repository Implementation (In-Memory)
 */
@Injectable()
export class UserBalanceChangeLogRepository
  implements IUserBalanceChangeLogRepository
{
  private logs: Map<number, UserBalanceChangeLog> = new Map();
  private currentId = 1;

  // ANCHOR userBalanceChangeLog.create
  async create(log: UserBalanceChangeLog): Promise<UserBalanceChangeLog> {
    const newLog = new UserBalanceChangeLog(
      this.currentId++,
      log.userId,
      log.amount,
      log.beforeAmount,
      log.afterAmount,
      log.code,
      log.note,
      log.refId,
      log.createdAt,
    );
    this.logs.set(newLog.id, newLog);
    return newLog;
  }

  // ANCHOR userBalanceChangeLog.findByUserId
  async findByUserId(userId: number): Promise<UserBalanceChangeLog[]> {
    return Array.from(this.logs.values())
      .filter((log) => log.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
