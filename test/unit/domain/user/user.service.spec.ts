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
import {
  ErrorCode,
  DomainException,
  ValidationException,
} from '@common/exception';

describe('UserDomainService', () => {
  let userDomainService: UserDomainService;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockBalanceLogRepository: jest.Mocked<IUserBalanceChangeLogRepository>;

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

    userDomainService = new UserDomainService(
      mockUserRepository,
      mockBalanceLogRepository,
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
        expect(error.name).toBe('ValidationException');
        expect((error as ValidationException).errorCode).toBe(
          ErrorCode.USER_NOT_FOUND,
        );
      }

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });
  });

  describe('getUserBalance', () => {
    it('사용자의 잔액을 조회한다', async () => {
      // given
      const userId = 1;
      const user = new User(userId, 50000);
      mockUserRepository.findById.mockResolvedValue(user);

      // when
      const balance = await userDomainService.getUserBalance(userId);

      // then
      expect(balance).toBe(50000);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('존재하지 않는 사용자의 잔액 조회 시 USER_NOT_FOUND 예외를 던진다', async () => {
      // given
      const userId = 999;
      mockUserRepository.findById.mockResolvedValue(null);

      // when & then
      await expect(userDomainService.getUserBalance(userId)).rejects.toThrow();

      try {
        await userDomainService.getUserBalance(userId);
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe(
          ErrorCode.USER_NOT_FOUND,
        );
      }
    });
  });

  describe('chargeUser', () => {
    it('사용자 잔액을 충전하고 로그를 저장한다', async () => {
      // given
      const userId = 1;
      const user = new User(userId, 10000);
      const chargeAmount = 5000;

      mockUserRepository.findById.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(user);
      mockBalanceLogRepository.create.mockResolvedValue({} as any);

      // when
      const result = await userDomainService.chargeUser(userId, chargeAmount);

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
      await userDomainService.chargeUser(userId, chargeAmount, refId, note);

      // then
      const logCall = mockBalanceLogRepository.create.mock.calls[0][0];
      expect(logCall.refId).toBe(refId);
      expect(logCall.note).toBe(note);
    });
  });

  describe('deductUser', () => {
    it('사용자 잔액을 차감하고 로그를 저장한다', async () => {
      // given
      const userId = 1;
      const user = new User(userId, 10000);
      const deductAmount = 3000;

      mockUserRepository.findById.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(user);
      mockBalanceLogRepository.create.mockResolvedValue({} as any);

      // when
      const result = await userDomainService.deductUser(userId, deductAmount);

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
      await userDomainService.deductUser(userId, deductAmount, refId, note);

      // then
      const logCall = mockBalanceLogRepository.create.mock.calls[0][0];
      expect(logCall.refId).toBe(refId);
      expect(logCall.note).toBe(note);
    });
  });

  describe('getUserBalanceChangeLogs', () => {
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
      const result = await userDomainService.getUserBalanceChangeLogs(userId);

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
      const result = await userDomainService.getUserBalanceChangeLogs(userId);

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

  describe('createUserBalanceChangeLog', () => {
    it('잔액 변경 이력을 생성한다', async () => {
      // given
      const userId = 1;
      const beforeAmount = 10000;
      const amount = 5000;
      const code = BalanceChangeCode.SYSTEM_CHARGE;
      const note = '테스트 충전';
      const refId = 100;

      const createdLog = new UserBalanceChangeLog(
        1,
        userId,
        amount,
        beforeAmount,
        15000,
        code,
        note,
        refId,
      );
      mockBalanceLogRepository.create.mockResolvedValue(createdLog);

      // when
      const result = await userDomainService.createUserBalanceChangeLog(
        userId,
        beforeAmount,
        amount,
        code,
        note,
        refId,
      );

      // then
      expect(result).toBe(createdLog);
      expect(mockBalanceLogRepository.create).toHaveBeenCalled();

      const logCall = mockBalanceLogRepository.create.mock.calls[0][0];
      expect(logCall.userId).toBe(userId);
      expect(logCall.amount).toBe(amount);
      expect(logCall.beforeAmount).toBe(beforeAmount);
      expect(logCall.afterAmount).toBe(15000); // 10000 + 5000
      expect(logCall.code).toBe(code);
      expect(logCall.note).toBe(note);
      expect(logCall.refId).toBe(refId);
    });

    it('note와 refId 없이 잔액 변경 이력을 생성할 수 있다', async () => {
      // given
      const userId = 1;
      const beforeAmount = 10000;
      const amount = 5000;
      const code = BalanceChangeCode.SYSTEM_CHARGE;

      const createdLog = new UserBalanceChangeLog(
        1,
        userId,
        amount,
        beforeAmount,
        15000,
        code,
        null,
        null,
      );
      mockBalanceLogRepository.create.mockResolvedValue(createdLog);

      // when
      const result = await userDomainService.createUserBalanceChangeLog(
        userId,
        beforeAmount,
        amount,
        code,
      );

      // then
      expect(result).toBe(createdLog);

      const logCall = mockBalanceLogRepository.create.mock.calls[0][0];
      expect(logCall.note).toBeNull();
      expect(logCall.refId).toBeNull();
    });
  });
});
