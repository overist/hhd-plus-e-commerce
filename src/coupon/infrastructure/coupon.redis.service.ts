import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@common/redis/redis.service';

/**
 * 쿠폰 발급 결과
 */
export interface CouponIssueResult {
  success: boolean;
  errorCode?:
    | 'COUPON_NOT_FOUND'
    | 'ALREADY_ISSUED'
    | 'COUPON_SOLD_OUT'
    | 'EXPIRED_COUPON';
  userCoupon?: {
    oderId: number | null;
    usedAt: Date | null;
    createdAt: Date;
    expiredAt: Date;
  };
}

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
  couponId: number;
  userId: number;
  orderId: number | null;
  createdAt: Date;
  usedAt: Date | null;
  expiredAt: Date;
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
      'createdAt', ARGV[1],
      'expiredAt', coupon['expiredAt'],
      'usedAt', '',
      'orderId', ''
    )

    return {1, coupon['expiredAt'], ARGV[1]}
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
  async issueCoupon(
    userId: number,
    couponId: number,
  ): Promise<CouponIssueResult> {
    const couponKey = `${CouponRedisService.COUPON_KEY_PREFIX}:${couponId}`;
    const userCouponKey = `${CouponRedisService.USER_COUPON_KEY_PREFIX}:${couponId}:${userId}`;
    const now = Date.now();

    const result = (await this.redisClient.eval(
      CouponRedisService.ISSUE_COUPON_LUA_SCRIPT,
      2, // Number of keys
      couponKey,
      userCouponKey,
      now.toString(),
    )) as [number, string, string];

    const [code, expiredAtStr, createdAtStr] = result;

    switch (code) {
      case 1:
        return {
          success: true,
          userCoupon: {
            oderId: null,
            usedAt: null,
            createdAt: new Date(parseInt(createdAtStr)),
            expiredAt: new Date(parseInt(expiredAtStr)),
          },
        };
      case -1:
        return { success: false, errorCode: 'COUPON_NOT_FOUND' };
      case -2:
        return { success: false, errorCode: 'ALREADY_ISSUED' };
      case -3:
        return { success: false, errorCode: 'COUPON_SOLD_OUT' };
      case -4:
        return { success: false, errorCode: 'EXPIRED_COUPON' };
      default:
        this.logger.error(`알 수 없는 Lua 스크립트 반환값: ${code}`);
        return { success: false, errorCode: 'COUPON_NOT_FOUND' };
    }
  }
}
