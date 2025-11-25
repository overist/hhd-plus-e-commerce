import { Injectable } from '@nestjs/common';
import {
  IUserBalanceChangeLogRepository,
  IUserRepository,
} from '@/user/domain/interfaces/user.repository.interface';
import { ErrorCode, DomainException } from '@common/exception';
import { User } from '../entities/user.entity';
import { UserBalanceChangeLog } from '../entities/user-balance-change-log.entity';
import { PrismaService } from '@common/prisma-manager/prisma.service';

/**
 * 잔액 변경 이력 조회 결과
 */
export interface BalanceLogsData {
  logs: UserBalanceChangeLog[];
  page: number;
  size: number;
  total: number;
}

/**
 * UserDomainService
 * 사용자 잔액 관련 핵심 비즈니스 로직을 담당한다.
 */
@Injectable()
export class UserDomainService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly balanceLogRepository: IUserBalanceChangeLogRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * ANCHOR 사용자 조회
   */
  async getUser(userId: number): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new DomainException(ErrorCode.USER_NOT_FOUND);
    }
    return user;
  }

  /**
   * ANCHOR 잔액 충전 처리
   * 낙관적 잠금 재시도 로직 포함
   */
  async chargeBalance(
    userId: number,
    amount: number,
    refId?: number,
    note?: string,
  ): Promise<User> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await this.prisma.$transaction(async () => {
          const user = await this.getUser(userId);
          const { user: updatedUser, log } = user.charge(amount, refId, note);

          await this.userRepository.update(updatedUser);
          await this.balanceLogRepository.create(log);

          return updatedUser;
        });
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

    throw new Error('Unexpected error in chargeBalance');
  }

  /**
   * ANCHOR 잔액 차감 처리
   * 낙관적 잠금 재시도 로직 포함
   */
  async deductBalance(
    userId: number,
    amount: number,
    refId?: number,
    note?: string,
  ): Promise<User> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await this.prisma.$transaction(async () => {
          const user = await this.getUser(userId);
          const { user: updatedUser, log } = user.deduct(amount, refId, note);

          await this.userRepository.update(updatedUser);
          await this.balanceLogRepository.create(log);

          return updatedUser;
        });
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

    throw new Error('Unexpected error in deductBalance');
  }

  /**
   * ANCHOR 잔액 변경 이력 조회
   */
  async getBalanceChangeLogs(userId: number): Promise<BalanceLogsData> {
    const logs = await this.balanceLogRepository.findByUserId(userId);
    return {
      logs,
      page: 1,
      size: logs.length,
      total: logs.length,
    };
  }

  /**
   * ANCHOR 사용자 생성
   */
  async createUser(): Promise<User> {
    const user = new User(0, 0);
    return this.userRepository.create(user);
  }
}
