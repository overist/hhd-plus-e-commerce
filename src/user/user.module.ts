import { Module } from '@nestjs/common';
import { GetBalanceUseCase } from '@/user/application/get-balance.use-case';
import { GetBalanceLogsUseCase } from '@/user/application/get-balance-logs.use-case';
import { ChargeBalanceUseCase } from '@/user/application/charge-balance.use-case';
import { UserDomainService } from '@/user/domain/services/user.service';
import {
  IUserRepository,
  IUserBalanceChangeLogRepository,
} from '@/user/domain/interfaces/user.repository.interface';
import {
  UserPrismaRepository,
  UserBalanceChangeLogRepository,
} from '@/user/infrastructure/user.prisma.repository';
import { UserController } from '@/user/presentation/user.controller';

/**
 * User Module
 * 사용자 및 잔액 관리 모듈
 */
@Module({
  controllers: [UserController],
  providers: [
    // User Repositories
    UserPrismaRepository,
    {
      provide: IUserRepository,
      useClass: UserPrismaRepository,
    },
    UserBalanceChangeLogRepository,
    {
      provide: IUserBalanceChangeLogRepository,
      useClass: UserBalanceChangeLogRepository,
    },

    // Domain Service
    UserDomainService,

    // UseCases
    GetBalanceUseCase,
    GetBalanceLogsUseCase,
    ChargeBalanceUseCase,
  ],
  exports: [
    UserDomainService,
    IUserRepository,
    IUserBalanceChangeLogRepository,
  ],
})
export class UserModule {}
