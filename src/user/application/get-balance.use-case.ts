import { Injectable } from '@nestjs/common';
import { UserDomainService } from '@/user/domain/services/user.service';
import { GetBalanceQuery, GetBalanceResult } from './dto/get-balance.dto';

@Injectable()
export class GetBalanceUseCase {
  constructor(private readonly userService: UserDomainService) {}

  /**
   * ANCHOR 잔액 조회
   */
  async execute(query: GetBalanceQuery): Promise<GetBalanceResult> {
    const user = await this.userService.getUser(query.userId);

    return GetBalanceResult.fromDomain(user);
  }
}
