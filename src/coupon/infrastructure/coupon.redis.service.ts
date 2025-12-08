import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@common/redis/redis.service';
import { ErrorCode, RepositoryException } from '@common/exception';
import { UserCoupon } from '../domain/entities/user-coupon.entity';
import { Coupon } from '../domain/entities/coupon.entity';

/**
 * 쿠폰 캐시 데이터
 */

export interface CachedCoupon {
  id: number;
  name: string;
  discountRate: number;
  totalQuantity: number;
  issuedQuantity: number;
  expiredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 사용자 쿠폰 캐시 데이터
 */
export interface CachedUserCoupon {
  userId: number;
  couponId: number;
  orderId: number | null;
  createdAt: Date;
  usedAt: Date | null;
  expiredAt: Date;
  updatedAt: Date;
}

/**
 * CouponRedisService
 * Redis를 활용한 쿠폰 캐시 및 원자적 발급 처리
 *
 * 인프라 계층에 위치하여 Redis와의 상호작용을 담당
 * - 쿠폰 캐시 저장/조회
 * - Lua 스크립트를 활용한 원자적 쿠폰 발급
 */
@Injectable()
export class CouponRedisService {
  private readonly logger = new Logger(CouponRedisService.name);
  private static readonly COUPON_KEY_PREFIX = 'data:coupon';
  private static readonly USER_COUPON_KEY_PREFIX = 'data:user-coupon';

  /**
   * Lua 스크립트: 원자적 쿠폰 발급
   * KEYS[1]: 쿠폰 정보 키 (data:coupon:{couponId})
   * KEYS[2]: 사용자 쿠폰 키 (data:user-coupon:{couponId}:{userId})
   * ARGV[1]: 현재 시간 (Unix timestamp ms)
   *
   * 반환값:
   * - 1: 성공
   * - -1: 쿠폰 없음 (COUPON_NOT_FOUND)
   * - -2: 이미 발급됨 (ALREADY_ISSUED)
   * - -3: 재고 소진 (COUPON_SOLD_OUT)
   * - -4: 만료된 쿠폰 (EXPIRED_COUPON)
   */
  private static readonly ISSUE_COUPON_LUA_SCRIPT = `
    -- 쿠폰 정보 조회
    local couponData = redis.call('HGETALL', KEYS[1])
    if #couponData == 0 then
      return {-1, '', ''}
    end

    -- Hash 배열을 테이블로 변환
    local coupon = {}
    for i = 1, #couponData, 2 do
      coupon[couponData[i]] = couponData[i + 1]
    end

    -- 이미 발급 여부 확인
    local userCouponExists = redis.call('EXISTS', KEYS[2])
    if userCouponExists == 1 then
      return {-2, '', ''}
    end

    -- 만료일 확인
    local expiredAt = tonumber(coupon['expiredAt'])
    local now = tonumber(ARGV[1])
    if now > expiredAt then
      return {-4, '', ''}
    end

    -- 재고 확인 및 차감 (원자적)
    local totalQuantity = tonumber(coupon['totalQuantity'])
    local issuedQuantity = tonumber(coupon['issuedQuantity'])
    if issuedQuantity >= totalQuantity then
      return {-3, '', ''}
    end

    -- 쿠폰 발급 수량 증가
    redis.call('HINCRBY', KEYS[1], 'issuedQuantity', 1)

    -- 사용자 쿠폰 생성
    redis.call('HSET', KEYS[2],
      'couponId', coupon['id'],
      'userId', ARGV[2],
      'createdAt', ARGV[1],
      'expiredAt', coupon['expiredAt'],
      'usedAt', '',
      'orderId', ''
    )

    return {1, coupon['id'], ARGV[2], coupon['expiredAt'], ARGV[1]}
  `;

  /**
   * Lua 스크립트: 원자적 쿠폰 사용
   * KEYS[1]: 쿠폰 정보 키 (data:coupon:{couponId})
   * KEYS[2]: 사용자 쿠폰 키 (data:user-coupon:{couponId}:{userId})
   * ARGV[1]: 현재 시간 (Unix timestamp ms)
   * ARGV[2]: 주문 ID
   *
   * 반환값:
   * - 1: 성공
   * - -1: 사용자 쿠폰 없음 (USER_COUPON_NOT_FOUND)
   * - -2: 이미 사용됨 (ALREADY_USED)
   * - -3: 만료된 쿠폰 (EXPIRED_COUPON)
   */
  private static readonly USE_COUPON_LUA_SCRIPT = `
    -- 사용자 쿠폰 정보 조회
    local userCouponData = redis.call('HGETALL', KEYS[2])
    if #userCouponData == 0 then
      return {-1, '', '', ''}
    end

    -- Hash 배열을 테이블로 변환
    local userCoupon = {}
    for i = 1, #userCouponData, 2 do
      userCoupon[userCouponData[i]] = userCouponData[i + 1]
    end

    -- 이미 사용 여부 확인
    local usedAt = userCoupon['usedAt']
    if usedAt ~= '' and usedAt ~= nil then
      return {-2, '', '', ''}
    end

    -- 만료일 확인
    local expiredAt = tonumber(userCoupon['expiredAt'])
    local now = tonumber(ARGV[1])
    if now > expiredAt then
      return {-3, '', '', ''}
    end

    -- 쿠폰 정보 조회 (할인율 등 필요)
    local couponData = redis.call('HGETALL', KEYS[1])
    local coupon = {}
    for i = 1, #couponData, 2 do
      coupon[couponData[i]] = couponData[i + 1]
    end

    -- 사용자 쿠폰 사용 처리
    redis.call('HSET', KEYS[2],
      'usedAt', ARGV[1],
      'orderId', ARGV[2]
    )

    -- code, createdAt, usedAt, expiredAt
    return {1, userCoupon['createdAt'], ARGV[1], userCoupon['expiredAt']}
  `;

  constructor(private readonly redisService: RedisService) {}

  private get redisClient() {
    return this.redisService.getClient();
  }

  /**
   * ANCHOR 쿠폰 발급
   * 레디스에 캐싱된 data로부터 발급
   * Lua 스크립트를 사용한 원자적 쿠폰 발급
   * 중복 발급 체크 + 재고 차감 + UserCoupon 생성을 원자적으로 처리
   */
  async issueCoupon(userId: number, couponId: number): Promise<UserCoupon> {
    const couponKey = `${CouponRedisService.COUPON_KEY_PREFIX}:${couponId}`;
    const userCouponKey = `${CouponRedisService.USER_COUPON_KEY_PREFIX}:${couponId}:${userId}`;
    const now = Date.now();

    const result = (await this.redisClient.eval(
      CouponRedisService.ISSUE_COUPON_LUA_SCRIPT,
      2, // Number of keys
      couponKey,
      userCouponKey,
      now.toString(),
      userId.toString(),
    )) as [number, string, string, string, string];

    const [code, couponIdStr, userIdStr, expiredAtStr, createdAtStr] = result;

    switch (code) {
      case 1:
        return new UserCoupon(
          0,
          parseInt(couponIdStr),
          parseInt(userIdStr),
          null,
          new Date(parseInt(createdAtStr)),
          null,
          new Date(parseInt(expiredAtStr)),
          new Date(),
        );
      case -1:
        throw new RepositoryException(ErrorCode.COUPON_NOT_FOUND);
      case -2:
        throw new RepositoryException(ErrorCode.ALREADY_ISSUED);
      case -3:
        throw new RepositoryException(ErrorCode.COUPON_SOLD_OUT);
      case -4:
        throw new RepositoryException(ErrorCode.EXPIRED_COUPON);
      default:
        this.logger.error(`알 수 없는 Lua 스크립트 반환값: ${code}`);
        throw new RepositoryException(ErrorCode.INVALID_COUPON);
    }
  }

  /**
   * ANCHOR 쿠폰 등록 - 쿠폰을 Redis에 캐싱
   */
  async cacheCoupon(coupon: CachedCoupon): Promise<void> {
    const key = `${CouponRedisService.COUPON_KEY_PREFIX}:${coupon.id}`;

    await this.redisClient.hset(key, {
      id: coupon.id.toString(),
      name: coupon.name,
      discountRate: coupon.discountRate.toString(),
      totalQuantity: coupon.totalQuantity.toString(),
      issuedQuantity: coupon.issuedQuantity.toString(),
      expiredAt: coupon.expiredAt.getTime().toString(),
      createdAt: coupon.createdAt.getTime().toString(),
      updatedAt: coupon.updatedAt.getTime().toString(),
    });

    this.logger.log(`쿠폰 Redis 캐싱 완료 - couponId: ${coupon.id}`);
  }

  /**
   * ANCHOR 쿠폰 조회 - Redis에서 쿠폰 조회
   */
  async getCachedCoupon(couponId: number): Promise<Coupon> {
    const key = `${CouponRedisService.COUPON_KEY_PREFIX}:${couponId}`;
    const data = await this.redisClient.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      throw new RepositoryException(ErrorCode.COUPON_NOT_FOUND);
    }

    return new Coupon(
      parseInt(data.id),
      data.name,
      parseFloat(data.discountRate),
      parseInt(data.totalQuantity),
      parseInt(data.issuedQuantity),
      new Date(parseInt(data.expiredAt)),
      new Date(parseInt(data.createdAt)),
      new Date(parseInt(data.updatedAt)),
    );
  }

  /**
   * ANCHOR 유저 쿠폰 조회 - Redis에서 유저 쿠폰 조회
   */
  async getCachedUserCoupons(userId: number): Promise<UserCoupon[]> {
    const pattern = `${CouponRedisService.USER_COUPON_KEY_PREFIX}:*:${userId}`;
    const keys = await this.redisClient.keys(pattern);
    const userCoupons: UserCoupon[] = [];

    for (const key of keys) {
      const data = await this.redisClient.hgetall(key);
      if (data && Object.keys(data).length > 0) {
        userCoupons.push(
          new UserCoupon(
            0,
            parseInt(data.userId),
            parseInt(data.couponId),
            data.orderId ? parseInt(data.orderId) : null,
            new Date(parseInt(data.createdAt)),
            data.usedAt ? new Date(parseInt(data.usedAt)) : null,
            new Date(parseInt(data.expiredAt)),
            new Date(parseInt(data.updatedAt)),
          ),
        );
      }
    }

    return userCoupons;
  }

  /**
   * ANCHOR 쿠폰 사용 (원자적) - Lua 스크립트
   * Redis에서 쿠폰 사용 처리 (사용 가능 여부 확인 + 사용 마킹)
   */
  async useUserCoupon(
    userId: number,
    couponId: number,
    orderId: number,
  ): Promise<UserCoupon> {
    const couponKey = `${CouponRedisService.COUPON_KEY_PREFIX}:${couponId}`;
    const userCouponKey = `${CouponRedisService.USER_COUPON_KEY_PREFIX}:${couponId}:${userId}`;
    const now = Date.now();

    const result = (await this.redisClient.eval(
      CouponRedisService.USE_COUPON_LUA_SCRIPT,
      2,
      couponKey,
      userCouponKey,
      now.toString(),
      orderId.toString(),
    )) as [number, string, string, string];

    const [code, createdAtStr, usedAtStr, expiredAtStr] = result;

    switch (code) {
      case 1:
        return new UserCoupon(
          0,
          userId,
          couponId,
          orderId,
          new Date(parseInt(createdAtStr)), //createdAt
          new Date(parseInt(usedAtStr)), //usedAt
          new Date(parseInt(expiredAtStr)), //expiredAt
          new Date(parseInt(usedAtStr)), //updatedAt
        );
      case -1:
        throw new RepositoryException(ErrorCode.COUPON_NOT_FOUND);
      case -2:
        throw new RepositoryException(ErrorCode.ALREADY_USED);
      case -3:
        throw new RepositoryException(ErrorCode.EXPIRED_COUPON);
      default:
        this.logger.error(`알 수 없는 Lua 스크립트 반환값: ${code}`);
        throw new RepositoryException(ErrorCode.INVALID_COUPON);
    }
  }

  /**
   * ANCHOR 쿠폰 사용 취소 - Redis에서 사용자 쿠폰 사용 취소 처리
   * 결제 실패 시 보상 트랜잭션에서 사용
   * @param orderId 취소할 주문 ID (이 주문에서 사용된 쿠폰만 취소)
   */
  async cancelCouponUse(
    userId: number,
    couponId: number,
    orderId?: number,
  ): Promise<void> {
    const key = `${CouponRedisService.USER_COUPON_KEY_PREFIX}:${couponId}:${userId}`;

    // orderId가 제공된 경우, 해당 주문에서 사용된 쿠폰인지 확인
    if (orderId) {
      const data = await this.redisClient.hgetall(key);
      if (data && data.orderId && parseInt(data.orderId) !== orderId) {
        this.logger.log(
          `쿠폰 사용 취소 스킵 - 다른 주문에서 사용된 쿠폰 - userId: ${userId}, couponId: ${couponId}, currentOrderId: ${data.orderId}, requestedOrderId: ${orderId}`,
        );
        return;
      }
    }

    await this.redisClient.hset(key, {
      usedAt: '',
      orderId: '',
    });

    this.logger.log(
      `쿠폰 사용 취소 완료 - userId: ${userId}, couponId: ${couponId}`,
    );
  }

  /**
   * ANCHOR 사용자 쿠폰 조회 - Redis에서 사용자 쿠폰 조회
   */
  async getCachedUserCoupon(
    userId: number,
    couponId: number,
  ): Promise<UserCoupon> {
    const key = `${CouponRedisService.USER_COUPON_KEY_PREFIX}:${couponId}:${userId}`;
    const data = await this.redisClient.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      throw new RepositoryException(ErrorCode.COUPON_NOT_FOUND);
    }

    const userCoupon = new UserCoupon(
      0,
      parseInt(data.userId),
      parseInt(data.couponId),
      data.orderId ? parseInt(data.orderId) : null,
      new Date(parseInt(data.createdAt)),
      data.usedAt ? new Date(parseInt(data.usedAt)) : null,
      new Date(parseInt(data.expiredAt)),
      new Date(parseInt(data.updatedAt)),
    );
    return userCoupon;
  }
}
