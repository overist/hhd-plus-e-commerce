import { Module } from '@nestjs/common';
import { UserFacade } from '@/user/application/user.facade';
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

    // Facade
    UserFacade,
  ],
  exports: [
    UserDomainService,
    IUserRepository,
    IUserBalanceChangeLogRepository,
  ],
})
export class UserModule {}
