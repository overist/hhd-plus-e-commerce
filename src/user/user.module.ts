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
  UserRepository,
  UserBalanceChangeLogRepository,
} from '@/user/infrastructure/user.repository';
import { UserController } from '@/user/presentation/user.controller';
import { UserKafkaProducer } from '@/user/infrastructure/user.kafka.producer';
import { UserOrderPaymentKafkaConsumer } from '@/user/presentation/consumers/order-payment.kafka.consumer';

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

    // UseCases
    GetBalanceUseCase,
    GetBalanceLogsUseCase,
    ChargeBalanceUseCase,

    // Kafka Producer/Consumers
    UserKafkaProducer,
    UserOrderPaymentKafkaConsumer,
  ],
  exports: [
    UserDomainService,
    IUserRepository,
    IUserBalanceChangeLogRepository,
  ],
})
export class UserModule {}
