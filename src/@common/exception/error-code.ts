export const ErrorCode = {
  // Product
  PRODUCT_NOT_FOUND: {
    code: 'P001',
    message: '상품을 찾을 수 없음',
  },
  INSUFFICIENT_STOCK: {
    code: 'P002',
    message: '재고 부족',
  },
  INVALID_STOCK_QUANTITY: {
    code: 'P003',
    message: '잘못된 재고 수량',
  },
  PRODUCT_OPTION_NOT_FOUND: {
    code: 'P004',
    message: '상품 옵션을 찾을 수 없음',
  },
  PRODUCT_UNAVAILABLE: {
    code: 'P005',
    message: '현재 판매중이 아닙니다.',
  },
  INVALID_PRICE: {
    code: 'P006',
    message: '잘못된 가격',
  },
  INVALID_ARGUMENT: {
    code: 'P007',
    message: '잘못된 인자 전달',
  },

  // Order
  INVALID_QUANTITY: {
    code: 'O001',
    message: '잘못된 수량',
  },
  ORDER_NOT_FOUND: {
    code: 'O002',
    message: '주문을 찾을 수 없음',
  },
  ORDER_EXPIRED: {
    code: 'O003',
    message: '주문서 만료 (10분 초과)',
  },
  ALREADY_PAID: {
    code: 'O004',
    message: '이미 결제된 주문',
  },
  UNAUTHORIZED_ORDER_ACCESS: {
    code: 'O005',
    message: '권한이 없습니다',
  },
  INVALID_ORDER_STATUS: {
    code: 'O006',
    message: '결제할 수 없는 주문입니다',
  },

  // Payment
  INSUFFICIENT_BALANCE: {
    code: 'PAY001',
    message: '잔액 부족',
  },
  PAYMENT_FAILED: {
    code: 'PAY002',
    message: '결제 실패',
  },

  // Coupon
  COUPON_SOLD_OUT: {
    code: 'C001',
    message: '쿠폰 품절',
  },
  INVALID_COUPON: {
    code: 'C002',
    message: '유효하지 않은 쿠폰',
  },
  EXPIRED_COUPON: {
    code: 'C003',
    message: '만료된 쿠폰',
  },
  ALREADY_USED: {
    code: 'C004',
    message: '이미 사용된 쿠폰',
  },
  ALREADY_ISSUED: {
    code: 'C005',
    message: '이미 발급된 쿠폰',
  },
  COUPON_NOT_FOUND: {
    code: 'C006',
    message: '쿠폰을 찾을 수 없습니다',
  },
  COUPON_INFO_NOT_FOUND: {
    code: 'C007',
    message: '쿠폰 정보를 찾을 수 없습니다',
  },
  INVALID_DISCOUNT_RATE: {
    code: 'C008',
    message: '잘못된 할인율',
  },
  INVALID_ISSUE_QUANTITY: {
    code: 'C009',
    message: '잘못된 발급 수량',
  },

  // User
  USER_NOT_FOUND: {
    code: 'U001',
    message: '사용자를 찾을 수 없음',
  },
  UNAUTHORIZED: {
    code: 'U002',
    message: '권한이 없습니다',
  },

  // User Balance Change Log
  INVALID_USER_BALANCE: {
    code: 'UBC001',
    message: '잔액은 0이상 정수여야 합니다',
  },
  USER_LOG_INVALID_CALCULATION: {
    code: 'UBC002',
    message: '잔액 변경 계산이 일치하지 않음',
  },

  // Cart
  CART_ITEM_NOT_FOUND: {
    code: 'CART001',
    message: '장바구니 항목을 찾을 수 없음',
  },

  // Numbering
  INVALID_AMOUNT: {
    code: 'D001',
    message: '수량은 0 이상 정수여야 합니다',
  },
} as const;
