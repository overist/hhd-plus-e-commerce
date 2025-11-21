import { UserDomainService } from '@domain/user/user.service';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';

export interface UserBalanceView {
  userId: number;
  balance: number;
}

@Injectable()
export class UserFacade {
  constructor(
    private readonly userService: UserDomainService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * ANCHOR user.chargeBalance
   * 낙관적 잠금으로 동시성 제어
   */
  async chargeBalance(
    userId: number,
    amount: number,
  ): Promise<UserBalanceView> {
    const user = await this.userService.chargeUser(userId, amount);

    return {
      userId: user.id,
      balance: user.balance,
    };
  }
}
