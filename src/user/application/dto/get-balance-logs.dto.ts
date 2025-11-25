import { UserBalanceChangeLog } from '@/user/domain/entities/user-balance-change-log.entity';

/**
 * 애플리케이션 레이어 DTO: GetBalanceLogs 요청
 */
export class GetBalanceLogsQuery {
  userId: number;
  from?: string;
  to?: string;
  code?: string;
  refId?: number;
  page?: number;
  size?: number;
}

/**
 * 애플리케이션 레이어 DTO: 개별 로그 항목
 */
export class BalanceLogItem {
  id: number;
  userId: number;
  amount: number;
  beforeAmount: number;
  afterAmount: number;
  code: string;
  note: string | null;
  refId: number | null;
  createdAt: Date;

  static fromDomain(log: UserBalanceChangeLog): BalanceLogItem {
    const item = new BalanceLogItem();
    item.id = log.id;
    item.userId = log.userId;
    item.amount = log.amount;
    item.beforeAmount = log.beforeAmount;
    item.afterAmount = log.afterAmount;
    item.code = log.code;
    item.note = log.note;
    item.refId = log.refId;
    item.createdAt = log.createdAt;
    return item;
  }
}

/**
 * 애플리케이션 레이어 DTO: GetBalanceLogs 응답
 */
export class GetBalanceLogsResult {
  logs: BalanceLogItem[];
  page: number;
  size: number;
  total: number;

  static fromDomain(
    logs: UserBalanceChangeLog[],
    page: number,
    size: number,
    total: number,
  ): GetBalanceLogsResult {
    const result = new GetBalanceLogsResult();
    result.logs = logs.map((log) => BalanceLogItem.fromDomain(log));
    result.page = page;
    result.size = size;
    result.total = total;
    return result;
  }
}
