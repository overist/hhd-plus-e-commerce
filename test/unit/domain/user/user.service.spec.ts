import { UserDomainService } from '@/user/domain/services/user.service';
import { User } from '@/user/domain/entities/user.entity';
import {
  UserBalanceChangeLog,
  BalanceChangeCode,
} from '@/user/domain/entities/user-balance-change-log.entity';
import {
  IUserRepository,
  IUserBalanceChangeLogRepository,
} from '@/user/domain/interfaces/user.repository.interface';
import { ErrorCode, DomainException } from '@common/exception';
import { PrismaService } from '@common/prisma-manager/prisma.service';

describe('UserDomainService', () => {
  let userDomainService: UserDomainService;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockBalanceLogRepository: jest.Mocked<IUserBalanceChangeLogRepository>;
  let mockPrismaService: jest.Mocked<PrismaService>;

  beforeEach(() => {
    // Mock Repository 생성
    mockUserRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
    } as any;

    mockBalanceLogRepository = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      create: jest.fn(),
    } as any;

    mockPrismaService = {
      $transaction: jest.fn((fn) => fn()),
    } as any;

    userDomainService = new UserDomainService(
      mockUserRepository,
      mockBalanceLogRepository,
      mockPrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUser', () => {
    it('사용자 ID로 사용자를 조회한다', async () => {
      // given
      const userId = 1;
      const user = new User(userId, 10000);
      mockUserRepository.findById.mockResolvedValue(user);

      // when
      const result = await userDomainService.getUser(userId);

      // then
      expect(result).toBe(user);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('존재하지 않는 사용자 ID로 조회하면 USER_NOT_FOUND 예외를 던진다', async () => {
      // given
      const userId = 999;
      mockUserRepository.findById.mockResolvedValue(null);

      // when & then
      await expect(userDomainService.getUser(userId)).rejects.toThrow();

      try {
        await userDomainService.getUser(userId);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.USER_NOT_FOUND,
        );
      }

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });
  });

  describe('chargeBalance', () => {
    it('사용자 잔액을 충전하고 로그를 저장한다', async () => {
      // given
      const userId = 1;
      const user = new User(userId, 10000);
      const chargeAmount = 5000;

      mockUserRepository.findById.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(user);
      mockBalanceLogRepository.create.mockResolvedValue({} as any);

      // when
      const result = await userDomainService.chargeBalance(
        userId,
        chargeAmount,
      );

      // then
      expect(result.balance).toBe(15000); // 10000 + 5000
      expect(mockUserRepository.update).toHaveBeenCalledWith(user);
      expect(mockBalanceLogRepository.create).toHaveBeenCalled();

      const logCall = mockBalanceLogRepository.create.mock.calls[0][0];
      expect(logCall.userId).toBe(userId);
      expect(logCall.amount).toBe(5000);
      expect(logCall.beforeAmount).toBe(10000);
      expect(logCall.afterAmount).toBe(15000);
      expect(logCall.code).toBe(BalanceChangeCode.SYSTEM_CHARGE);
    });

    it('refId와 note를 포함하여 충전할 수 있다', async () => {
      // given
      const userId = 1;
      const user = new User(userId, 10000);
      const chargeAmount = 5000;
      const refId = 100;
      const note = '관리자 충전';

      mockUserRepository.findById.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(user);
      mockBalanceLogRepository.create.mockResolvedValue({} as any);

      // when
      await userDomainService.chargeBalance(userId, chargeAmount, refId, note);

      // then
      const logCall = mockBalanceLogRepository.create.mock.calls[0][0];
      expect(logCall.refId).toBe(refId);
      expect(logCall.note).toBe(note);
    });
  });

  describe('deductBalance', () => {
    it('사용자 잔액을 차감하고 로그를 저장한다', async () => {
      // given
      const userId = 1;
      const user = new User(userId, 10000);
      const deductAmount = 3000;

      mockUserRepository.findById.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(user);
      mockBalanceLogRepository.create.mockResolvedValue({} as any);

      // when
      const result = await userDomainService.deductBalance(
        userId,
        deductAmount,
      );

      // then
      expect(result.balance).toBe(7000); // 10000 - 3000
      expect(mockUserRepository.update).toHaveBeenCalledWith(user);
      expect(mockBalanceLogRepository.create).toHaveBeenCalled();

      const logCall = mockBalanceLogRepository.create.mock.calls[0][0];
      expect(logCall.userId).toBe(userId);
      expect(logCall.amount).toBe(-3000); // 음수로 기록
      expect(logCall.beforeAmount).toBe(10000);
      expect(logCall.afterAmount).toBe(7000);
      expect(logCall.code).toBe(BalanceChangeCode.PAYMENT);
    });

    it('refId와 note를 포함하여 차감할 수 있다', async () => {
      // given
      const userId = 1;
      const user = new User(userId, 10000);
      const deductAmount = 3000;
      const refId = 200;
      const note = '주문 결제';

      mockUserRepository.findById.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(user);
      mockBalanceLogRepository.create.mockResolvedValue({} as any);

      // when
      await userDomainService.deductBalance(userId, deductAmount, refId, note);

      // then
      const logCall = mockBalanceLogRepository.create.mock.calls[0][0];
      expect(logCall.refId).toBe(refId);
      expect(logCall.note).toBe(note);
    });
  });

  describe('getBalanceChangeLogs', () => {
    it('사용자의 잔액 변경 이력을 조회한다', async () => {
      // given
      const userId = 1;
      const logs = [
        new UserBalanceChangeLog(
          1,
          userId,
          5000,
          0,
          5000,
          BalanceChangeCode.SYSTEM_CHARGE,
          null,
          null,
        ),
        new UserBalanceChangeLog(
          2,
          userId,
          -3000,
          5000,
          2000,
          BalanceChangeCode.PAYMENT,
          null,
          null,
        ),
      ];
      mockBalanceLogRepository.findByUserId.mockResolvedValue(logs);

      // when
      const result = await userDomainService.getBalanceChangeLogs(userId);

      // then
      expect(result.logs).toEqual(logs);
      expect(result.page).toBe(1);
      expect(result.size).toBe(2);
      expect(result.total).toBe(2);
      expect(mockBalanceLogRepository.findByUserId).toHaveBeenCalledWith(
        userId,
      );
    });

    it('잔액 변경 이력이 없으면 빈 배열을 반환한다', async () => {
      // given
      const userId = 1;
      mockBalanceLogRepository.findByUserId.mockResolvedValue([]);

      // when
      const result = await userDomainService.getBalanceChangeLogs(userId);

      // then
      expect(result.logs).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('createUser', () => {
    it('새로운 사용자를 생성한다', async () => {
      // given
      const newUser = new User(1, 0);
      mockUserRepository.create.mockResolvedValue(newUser);

      // when
      const result = await userDomainService.createUser();

      // then
      expect(result).toBe(newUser);
      expect(mockUserRepository.create).toHaveBeenCalled();

      const userCall = mockUserRepository.create.mock.calls[0][0];
      expect(userCall.balance).toBe(0);
    });
  });
});
