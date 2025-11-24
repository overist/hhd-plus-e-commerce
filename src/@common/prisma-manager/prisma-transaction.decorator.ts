import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * 메서드를 Prisma 트랜잭션 컨텍스트에서 실행하도록 보장하는 데코레이터.
 * 기본적으로 `this.prismaService`에 접근해 트랜잭션을 열지만, 다른 프로퍼티명을
 * 사용하고 싶다면 `@Transactional('customProperty')`처럼 지정할 수 있다.
 */

type TransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

/**
 * 사용법: @Transactional() 또는 @Transactional({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
 */
export function Transactional(param?: TransactionOptions) {
  const txOptions = param ?? {};

  return function (
    target: object,
    propertyName: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const original = descriptor.value;

    if (typeof original !== 'function') {
      throw new Error('@Transactional()은 메서드에만 사용할 수 있습니다.');
    }

    descriptor.value = async function (...args: unknown[]) {
      const instance = this as Record<string, unknown>;
      const prismaService = instance['prismaService'] as
        | PrismaService
        | undefined;

      if (
        !prismaService ||
        typeof prismaService.runInTransaction !== 'function'
      ) {
        throw new Error(
          `해당 클래스에 @Transactional() 데코레이터가 사용할 PrismaService("prismaService")를 찾을 수 없습니다.`,
        );
      }

      const executeOriginal = () => Promise.resolve(original.apply(this, args));

      if (
        typeof prismaService.getTransactionClient === 'function' &&
        prismaService.getTransactionClient()
      ) {
        return executeOriginal();
      }

      return prismaService.runInTransaction(
        () => executeOriginal(),
        Object.keys(txOptions).length ? txOptions : undefined,
      );
    };

    return descriptor;
  };
}
