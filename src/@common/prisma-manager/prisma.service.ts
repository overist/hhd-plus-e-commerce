import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { Prisma, PrismaClient } from '@prisma/client';
import { TransactionOptions } from './prisma-transaction.types';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly txStorage =
    new AsyncLocalStorage<Prisma.TransactionClient>();

  /**
   * 실행 컨텍스트에 맞는 Prisma 클라이언트를 반환한다.
   * 트랜잭션이 활성화되어 있다면 해당 트랜잭션 클라이언트를 돌려준다.
   */
  getClient(): Prisma.TransactionClient | PrismaClient {
    return this.txStorage.getStore() ?? this;
  }

  /**
   * 현재 컨텍스트에서 활성화된 트랜잭션 클라이언트를 반환한다.
   * 트랜잭션이 없으면 `null`을 반환한다.
   */
  getTransactionClient(): Prisma.TransactionClient | null {
    return this.txStorage.getStore() ?? null;
  }

  /**
   * 트랜잭션 컨텍스트를 열고 주어진 핸들러를 실행한다.
   * 핸들러 내부에서 레포지토리를 호출하면 자동으로 트랜잭션 클라이언트를 사용한다.
   */
  async runInTransaction<T>(
    handler: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    return this.$transaction(
      async (tx) => this.txStorage.run(tx, () => handler(tx)),
      options,
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
