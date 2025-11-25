import { Injectable } from '@nestjs/common';
import { UserDomainService } from '@/user/domain/services/user.service';
import {
  ChargeBalanceCommand,
  ChargeBalanceResult,
} from './dto/charge-balance.dto';

@Injectable()
export class ChargeBalanceUseCase {
  constructor(private readonly userService: UserDomainService) {}

  /**
   * ANCHOR 잔액 충전
   * 낙관적 잠금으로 동시성 제어
   */
  async execute(cmd: ChargeBalanceCommand): Promise<ChargeBalanceResult> {
    const user = await this.userService.chargeBalance(cmd.userId, cmd.amount);

    return ChargeBalanceResult.fromDomain(user);
  }
}
