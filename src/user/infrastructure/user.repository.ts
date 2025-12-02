import { Injectable } from '@nestjs/common';
import { Prisma, user_balance_change_log, users } from '@prisma/client';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import {
  IUserRepository,
  IUserBalanceChangeLogRepository,
} from '../domain/interfaces/user.repository.interface';
import { User } from '@/user/domain/entities/user.entity';
import {
  BalanceChangeCode,
  UserBalanceChangeLog,
} from '@/user/domain/entities/user-balance-change-log.entity';

/**
 * User Repository Implementation (Prisma)
 * 동시성 제어: 낙관적 잠금(Optimistic Locking) 사용
 */
@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 트랜잭션 컨텍스트가 있다면 해당 클라이언트를, 없다면 기본 클라이언트를 돌려준다.
   */
  private get prismaClient(): Prisma.TransactionClient | PrismaService {
    return this.prisma.getClient();
  }

  // ANCHOR user.findById
  async findById(id: number): Promise<User | null> {
    // 낙관적 잠금 사용
    const record = await this.prismaClient.users.findUnique({ where: { id } });
    return record ? this.mapToDomain(record) : null;
  }

  // ANCHOR user.create
  async create(user: User): Promise<User> {
    const created = await this.prismaClient.users.create({
      data: {
        balance: user.balance,
        version: 1,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
      },
    });
    return this.mapToDomain(created);
  }

  // ANCHOR user.update
  async update(user: User): Promise<User> {
    // 낙관적 잠금: version을 조건으로 추가하여 동시성 충돌 감지
    const updated = await this.prismaClient.users.updateMany({
      where: {
        id: user.id,
        version: user.version, // 현재 version으로 조건 검사
      },
      data: {
        balance: user.balance,
        version: user.version + 1, // version 증가
        updated_at: user.updatedAt,
      },
    });

    if (updated.count === 0) {
      throw new Error('Optimistic lock error: User update failed by version');
    }

    // 업데이트된 레코드 재조회
    const refreshed = (await this.prismaClient.users.findUnique({
      where: { id: user.id },
    })) as users;
    return this.mapToDomain(refreshed);
  }

  /**
   * Helper 도메인 맵퍼
   */
  private mapToDomain(record: users): User {
    const maybeDecimal = record.balance as { toNumber?: () => number };
    const balance =
      typeof maybeDecimal?.toNumber === 'function'
        ? maybeDecimal.toNumber()
        : Number(record.balance);
    return new User(
      record.id,
      balance,
      record.created_at,
      record.updated_at,
      record.version,
    );
  }
}

/**
 * UserBalanceChangeLog Repository Implementation (Prisma)
 */
@Injectable()
export class UserBalanceChangeLogRepository
  implements IUserBalanceChangeLogRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private get prismaClient(): Prisma.TransactionClient | PrismaService {
    return this.prisma.getClient();
  }

  // ANCHOR userBalanceChangeLog.create
  async create(log: UserBalanceChangeLog): Promise<UserBalanceChangeLog> {
    const created = await this.prismaClient.user_balance_change_log.create({
      data: {
        user_id: log.userId,
        amount: log.amount,
        before_amount: log.beforeAmount,
        after_amount: log.afterAmount,
        code: log.code,
        note: log.note,
        ref_id: log.refId,
        created_at: log.createdAt,
      },
    });
    return this.mapToDomain(created);
  }

  // ANCHOR userBalanceChangeLog.findByUserId
  /**
   * TODO: [성능 개선 필요] ORDER BY 최적화
   * 현재 상태: WHERE user_id = ? ORDER BY created_at DESC
   *
   * 개선 방안:
   * 1. 복합 인덱스 추가: (user_id, created_at DESC)
   *    - 현재는 user_id 단일 인덱스만 존재
   * 2. 인덱스 생성 쿼리:
   *    CREATE INDEX idx_balance_log_user_created ON user_balance_change_log(user_id, created_at DESC);
   * 3. 페이징 추가 고려:
   *    - 잔액 변경 로그는 계속 증가하는 데이터
   *    - LIMIT, OFFSET을 활용한 페이징 필요
   *
   * 예상 효과:
   * - 정렬을 위한 filesort 연산 제거
   * - 대용량 데이터에서도 안정적인 성능 보장
   */
  async findByUserId(userId: number): Promise<UserBalanceChangeLog[]> {
    const records = await this.prismaClient.user_balance_change_log.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
    return records.map((record) => this.mapToDomain(record));
  }

  /**
   * Helper 도메인 맵퍼
   */
  private mapToDomain(record: user_balance_change_log): UserBalanceChangeLog {
    const toNumber = (value: any): number => {
      const maybeDecimal = value as { toNumber?: () => number };
      return typeof maybeDecimal?.toNumber === 'function'
        ? maybeDecimal.toNumber()
        : Number(value);
    };

    return new UserBalanceChangeLog(
      Number(record.id),
      record.user_id,
      toNumber(record.amount),
      toNumber(record.before_amount),
      toNumber(record.after_amount),
      record.code as BalanceChangeCode,
      record.note,
      record.ref_id ? Number(record.ref_id) : null,
      record.created_at,
    );
  }
}
