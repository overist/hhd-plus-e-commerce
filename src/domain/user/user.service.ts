import { Injectable } from '@nestjs/common';
import {
  IUserBalanceChangeLogRepository,
  IUserRepository,
} from '@domain/interfaces';
import {
  DomainException,
  ValidationException,
} from '@domain/common/exceptions';
import { ErrorCode } from '@domain/common/constants/error-code';
import { User } from './user.entity';
import {
  BalanceChangeCode,
  UserBalanceChangeLog,
} from './user-balance-change-log.entity';

export interface GetBalanceLogsDto {
  logs: UserBalanceChangeLog[];
  page: number;
  size: number;
  total: number;
}

/**
 * UserDomainService
 * 사용자 잔액 관련 핵심 규칙 담당.
 */
@Injectable()
export class UserDomainService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly balanceLogRepository: IUserBalanceChangeLogRepository,
  ) {}

  /**
   * ANCHOR 사용자 조회
   */
  async getUser(userId: number): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ValidationException(ErrorCode.USER_NOT_FOUND);
    }

    return user;
  }

  /**
   * ANCHOR 사용자 잔액 조회
   */
  async getUserBalance(userId: number): Promise<number> {
    const user = await this.loadUserOrFail(userId);
    return user.balance;
  }
  async loadUserOrFail(userId: number): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new DomainException(ErrorCode.USER_NOT_FOUND);
    }
    return user;
  }

  /**
   * ANCHOR 잔액 충전 처리
   * 낙관적 잠금 재시도 로직
   */
  async chargeUser(
    userId: number,
    amount: number,
    refId?: number,
    note?: string,
  ): Promise<User> {
    // 낙관적 잠금 재시도 로직
    const maxRetries = 10;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const _user = await this.getUser(userId);
        const { user, log } = _user.charge(amount, refId, note);

        await this.userRepository.update(user);
        await this.balanceLogRepository.create(log);

        return user;
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw error;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 10),
        );
      }
    }

    throw new Error('Unexpected error in chargeUser');
  }

  /**
   * ANCHOR 잔액 차감 처리
   */
  async deductUser(
    userId: number,
    amount: number,
    refId?: number,
    note?: string,
  ): Promise<User> {
    // 낙관적 잠금 재시도 로직
    const maxRetries = 10;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const _user = await this.getUser(userId);
        const { user, log } = _user.deduct(amount, refId, note);

        await this.userRepository.update(user);
        await this.balanceLogRepository.create(log);

        return user;
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw error;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 10),
        );
      }
    }

    throw new Error('Unexpected error in deductUser');
  }

  /**
   * ANCHOR 잔액 변경 이력 조회
   * RF-022: 시스템은 사용자의 잔액 변경 이력을 조회할 수 있어야 한다
   */
  async getUserBalanceChangeLogs(userId: number): Promise<GetBalanceLogsDto> {
    const logs = await this.balanceLogRepository.findByUserId(userId);
    return { logs, page: 1, size: logs.length, total: logs.length };
  }

  /**
   * ANCHOR 사용자 저장
   */
  async createUser(): Promise<User> {
    const user = new User(0, 0);
    return this.userRepository.create(user);
  }

  /**
   * ANCHOR 잔액 변경 이력 저장
   */
  async createUserBalanceChangeLog(
    userId: number,
    beforeAmount: number,
    amount: number,
    code: BalanceChangeCode,
    note?: string,
    refId?: number,
  ): Promise<UserBalanceChangeLog> {
    const afterAmount = beforeAmount + amount;

    const log = new UserBalanceChangeLog(
      0, // ID는 나중에 할당
      userId,
      amount,
      beforeAmount,
      afterAmount,
      code,
      note ?? null,
      refId ?? null,
    );

    const createdLog = await this.balanceLogRepository.create(log);
    return createdLog;
  }
}
