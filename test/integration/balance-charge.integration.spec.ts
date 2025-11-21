import { UserFacade } from '@application/facades/user.facade';
import { UserDomainService } from '@domain/user/user.service';
import {
  UserRepository,
  UserBalanceChangeLogRepository,
} from '@infrastructure/repositories/prisma';
import { User } from '@domain/user/user.entity';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import {
  setupIntegrationTest,
  cleanupDatabase,
  teardownIntegrationTest,
} from './setup';

describe('잔액 충전 통합 테스트 (관리자 기능)', () => {
  let prismaService: PrismaService;
  let userFacade: UserFacade;
  let userRepository: UserRepository;

  beforeAll(async () => {
    prismaService = await setupIntegrationTest();
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
    );

    userFacade = new UserFacade(userDomainService, prismaService);
  });

  describe('user.balance 동시성', () => {
    it('동시에 10번 충전 시 잔액이 정확히 증가한다', async () => {
      // Given: 초기 잔액 10,000원
      const user = await userRepository.create(new User(0, 10000));

      // When: 10번 동시에 5,000원씩 충전
      await Promise.all(
        Array.from({ length: 10 }, () =>
          userFacade.chargeBalance(user.id, 5000),
        ),
      );

      // Then: 정확히 60,000원
      const updatedUser = await userRepository.findById(user.id);
      expect(updatedUser!.balance).toBe(60000);
    }, 30000); // 30초 타임아웃
  });
});
