/**
 * Cache Keys
 * 애플리케이션에서 사용하는 캐시 키 상수 모음
 *
 * 캐시 키 네이밍 규칙:
 * - 리소스/액션 형태 (예: products/top, users/profile)
 * - 소문자 + 슬래시 구분자
 * - 동적 파라미터는 사용처에서 suffix로 추가 (예: `${CACHE_KEYS.PRODUCT_DETAIL}/${productId}`)
 */
export const CACHE_KEYS = {
  // ===== Product =====
  /** 인기 상품 목록 (최근 3일간 판매량 기준 상위 5개) */
  PRODUCTS_TOP: 'products/top',

  /** 상품 상세 정보 (사용 시: `${CACHE_KEYS.PRODUCT_DETAIL}/${productId}`) */
  PRODUCT_DETAIL: 'products/detail',

  /** 상품 목록 */
  PRODUCTS_LIST: 'products/list',

  // ===== User =====
  /** 사용자 프로필 (사용 시: `${CACHE_KEYS.USER_PROFILE}/${userId}`) */
  USER_PROFILE: 'users/profile',

  /** 사용자 잔액 (사용 시: `${CACHE_KEYS.USER_BALANCE}/${userId}`) */
  USER_BALANCE: 'users/balance',

  // ===== Coupon =====
  /** 발급 가능한 쿠폰 목록 */
  COUPONS_AVAILABLE: 'coupons/available',

  // ===== Cart =====
  /** 장바구니 (사용 시: `${CACHE_KEYS.CART}/${userId}`) */
  CART: 'carts',
} as const;

/**
 * Cache TTL (밀리초)
 * 캐시 만료 시간 상수 모음
 */
export const CACHE_TTL = {
  /** 1분 */
  ONE_MINUTE: 60 * 1000,

  /** 5분 */
  FIVE_MINUTES: 5 * 60 * 1000,

  /** 10분 */
  TEN_MINUTES: 10 * 60 * 1000,

  /** 30분 */
  THIRTY_MINUTES: 30 * 60 * 1000,

  /** 1시간 */
  ONE_HOUR: 60 * 60 * 1000,

  /** 1일 */
  ONE_DAY: 24 * 60 * 60 * 1000,
} as const;
