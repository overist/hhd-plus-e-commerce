import { ChargeBalanceUseCase } from '@/user/application/charge-balance.use-case';
import { UserDomainService } from '@/user/domain/services/user.service';
import {
  UserRepository,
  UserBalanceChangeLogRepository,
} from '@/user/infrastructure/user.repository';
import { User } from '@/user/domain/entities/user.entity';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import {
  setupDatabaseTest,
  cleanupDatabase,
  teardownIntegrationTest,
} from '../setup';

describe('잔액 충전 통합 테스트 (관리자 기능)', () => {
  let prismaService: PrismaService;
  let chargeBalanceUseCase: ChargeBalanceUseCase;
  let userRepository: UserRepository;

  beforeAll(async () => {
    prismaService = await setupDatabaseTest();
  }, 60000); // 60초 타임아웃

  afterAll(async () => {
    await teardownIntegrationTest();
  }, 60000); // 60초 타임아웃

  beforeEach(async () => {
    await cleanupDatabase(prismaService);

    userRepository = new UserRepository(prismaService);
    const balanceLogRepository = new UserBalanceChangeLogRepository(
      prismaService,
    );
    const userDomainService = new UserDomainService(
      userRepository,
      balanceLogRepository,
      prismaService,
    );

    chargeBalanceUseCase = new ChargeBalanceUseCase(userDomainService);
  });

  describe('user.balance 동시성', () => {
    it('동시에 3번 충전 시 잔액이 정확히 증가한다', async () => {
      // Given: 초기 잔액 10,000원
      const user = await userRepository.create(new User(0, 10000));

      // When: 3번 동시에 5,000원씩 충전
      await Promise.all(
        Array.from({ length: 3 }, () =>
          chargeBalanceUseCase.execute({ userId: user.id, amount: 5000 }),
        ),
      );

      // Then: 정확히 25,000원
      const updatedUser = await userRepository.findById(user.id);
      expect(updatedUser!.balance).toBe(25000);
    }, 30000); // 30초 타임아웃
  });
});
