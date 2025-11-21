import { Module } from '@nestjs/common';
import { UserFacade } from '@application/facades/user.facade';
import { UserDomainService } from '@domain/user/user.service';
import {
  IUserRepository,
  IUserBalanceChangeLogRepository,
} from '@domain/interfaces/user.repository.interface';
import {
  UserRepository,
  UserBalanceChangeLogRepository,
} from '@infrastructure/repositories/prisma/user.repository';
import { UserController } from '@presentation/user/user.controller';

/**
 * User Module
 * 사용자 및 잔액 관리 모듈
 */
@Module({
  controllers: [UserController],
  providers: [
    // User Repositories
    UserRepository,
    {
      provide: IUserRepository,
      useClass: UserRepository,
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
