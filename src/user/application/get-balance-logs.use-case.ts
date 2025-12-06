import { Injectable } from '@nestjs/common';
import { UserDomainService } from '@/user/domain/services/user.service';
import {
  GetBalanceLogsQuery,
  GetBalanceLogsResult,
} from './dto/get-balance-logs.dto';

@Injectable()
export class GetBalanceLogsUseCase {
  constructor(private readonly userService: UserDomainService) {}

  /**
   * ANCHOR 잔액 변경 이력 조회
   */
  async getBalanceLogs(
    query: GetBalanceLogsQuery,
  ): Promise<GetBalanceLogsResult> {
    const { logs, page, size, total } =
      await this.userService.getBalanceChangeLogs(query.userId);

    return GetBalanceLogsResult.fromDomain(logs, page, size, total);
  }
}
