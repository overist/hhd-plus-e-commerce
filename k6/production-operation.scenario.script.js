/* eslint-disable no-undef */
/**
 * 운영 시나리오(회원가입 + 쿠폰발급 + 상품조회 + 확률적(5%) [주문+결제+외부플랫폼전송]) 스트레스/피크 테스트
 *
 * 목적:
 *   운영 시나리오의 최대 처리량(Throughput) 측정
 *
 * 테스트 실행 예시:
K6_OUT=influxdb=http://admin:admin1234@210.124.110.5:8086/k6 \
k6 run k6/production-operation.scenario.script.js \
-e SCENARIO=stress \
-e BASE_URL=http://210.124.110.5:3000
 *
 * 참고:
 * - stage 환경(`NODE_ENV=stage`)에서는 AuthGuard가 우회되어 세션 없이 호출 가능합니다.
 * - stage 환경에서는 신규 가입 시 초기 잔액이 10억입니다.
 */

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// ** 환경변수/경로 설정 **
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const COUPON_ID = Number(__ENV.COUPON_ID || 1);
const ORDER_PROBABILITY = Number(__ENV.ORDER_PROBABILITY || 0.05); // 5%
const ORDER_DETAIL_ORDER_ID = __ENV.ORDER_DETAIL_ORDER_ID
  ? Number(__ENV.ORDER_DETAIL_ORDER_ID)
  : null;
const ORDER_DETAIL_ORDER_IDS = __ENV.ORDER_DETAIL_ORDER_IDS
  ? String(__ENV.ORDER_DETAIL_ORDER_IDS)
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0)
  : [1];
const ORDER_PRODUCT_OPTION_ID = __ENV.ORDER_PRODUCT_OPTION_ID
  ? Number(__ENV.ORDER_PRODUCT_OPTION_ID)
  : null;
const ORDER_PRODUCT_OPTION_IDS = __ENV.ORDER_PRODUCT_OPTION_IDS
  ? String(__ENV.ORDER_PRODUCT_OPTION_IDS)
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0)
  : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

const SIGNUP_PATH = '/api/auth/signup';
const COUPON_ISSUE_PATH = `/api/coupons/${COUPON_ID}/issue`;
const CREATE_ORDER_PATH = '/api/orders';

// ** 메트릭 정의 **
const operationSuccessRate = new Rate('operation_success_rate');

const allErrors = new Counter('errors');
const signupErrors = new Counter('errors_operation_signup');
const couponErrors = new Counter('errors_operation_coupon');
const orderDetailErrors = new Counter('errors_operation_order_detail');
const orderErrors = new Counter('errors_operation_order');
const paymentErrors = new Counter('errors_operation_payment');
const processOrderCount = new Counter('process_order_count');

// ** 테스트 시나리오 **
const SCENARIO = __ENV.SCENARIO || 'stress';

const scenarios = {
  // Stress Test: 점진적으로 부하를 올리며 한계점 탐색
  stress: {
    executor: 'ramping-arrival-rate',
    startRate: 10,
    timeUnit: '1s',
    preAllocatedVUs: 1000,
    maxVUs: 1000,
    stages: [
      { duration: '60s', target: 100 },
      { duration: '60s', target: 150 },
      { duration: '60s', target: 200 },
    ],
  },
};

// ANCHOR STEP0: [CONFIG] k6 옵션 설정
export const options = {
  scenarios: {
    production_operation: scenarios[SCENARIO],
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    operation_success_rate: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'min', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ANCHOR STEP1: [BEFORE] k6 set up before each VU
export function setup() {
  return {};
}

// ANCHOR STEP2: [MAIN] k6 executed by each VU
export default function () {
  // 1) 회원가입
  const signupResult = signup();
  if (!signupResult?.ok) {
    operationSuccessRate.add(false);
    return;
  }

  const userId = signupResult.userId;

  // 2) 쿠폰발급 (품절/중복발급은 운영상 '정상 처리'로 간주)
  const couponResult = issueCoupon(userId);
  if (!couponResult?.ok) {
    operationSuccessRate.add(false);
    return;
  }

  // 3) 조회 (주문 상세 조회)
  const orderDetailOk = callOrderDetail();
  if (!orderDetailOk) {
    operationSuccessRate.add(false);
    return;
  }

  // 4) 확률적(5%) 주문 생성
  const doOrder = Math.random() < ORDER_PROBABILITY;
  if (doOrder) {
    const orderResult = createRandomOrder(userId);
    if (!orderResult?.ok) {
      operationSuccessRate.add(false);
      return;
    }

    const paymentOk = processOrder({
      orderId: orderResult.orderId,
      userId,
      couponId: couponResult?.userCouponId != null ? COUPON_ID : null,
    });
    if (!paymentOk) {
      operationSuccessRate.add(false);
      return;
    }
  }

  operationSuccessRate.add(true);
}

function signup() {
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '60s',
  };

  const res = http.post(`${BASE_URL}${SIGNUP_PATH}`, null, params);

  const ok = check(res, {
    'signup returns 201': (r) => r.status === 201,
  });

  if (!ok) {
    allErrors.add(1);
    signupErrors.add(1);
    console.error(
      `signup failed: ${res.status} ${String(res.body).slice(0, 120)}`,
    );
    return { ok: false };
  }

  try {
    const body = JSON.parse(res.body);
    const userId = body?.userId;
    if (!userId) {
      allErrors.add(1);
      signupErrors.add(1);
      console.error(`signup invalid body: ${String(res.body).slice(0, 120)}`);
      return { ok: false };
    }

    return { ok: true, userId };
  } catch (err) {
    allErrors.add(1);
    signupErrors.add(1);
    console.error(
      `signup parse error: ${err} body=${String(res.body).slice(0, 120)}`,
    );
    return { ok: false };
  }
}

function issueCoupon(userId) {
  const payload = JSON.stringify({ userId });
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '60s',
  };

  const res = http.post(`${BASE_URL}${COUPON_ISSUE_PATH}`, payload, params);

  // HTML 에러 페이지 / 비정상 content-type 방어
  const contentType =
    (res.headers &&
      (res.headers['Content-Type'] || res.headers['content-type'])) ||
    '';
  const bodyText = res.body ?? '';
  const looksLikeHtml =
    typeof bodyText === 'string' && bodyText.trimStart().startsWith('<');

  if (!contentType.includes('application/json') || looksLikeHtml) {
    allErrors.add(1);
    couponErrors.add(1);
    console.error(
      `coupon non-json response: status=${res.status} content-type=${contentType} body-prefix=${String(bodyText).slice(0, 80)}`,
    );
    return { ok: false };
  }

  // 품절/중복발급은 운영상 정상 흐름으로 처리(기존 쿠폰 스크립트와 동일한 관점)
  if (res.status === 422) {
    return { ok: true, userCouponId: null };
  }

  if (typeof bodyText === 'string' && bodyText.includes('이미 발급된 쿠폰')) {
    return { ok: true, userCouponId: null };
  }

  const ok = check(res, {
    'coupon issue returns 201 or expected 4xx': (r) =>
      r.status === 201 || r.status === 400 || r.status === 404,
  });

  if (!ok) {
    allErrors.add(1);
    couponErrors.add(1);
    console.error(
      `coupon issue failed: ${res.status} ${String(bodyText).slice(0, 120)}`,
    );
    return { ok: false };
  }

  if (res.status !== 201) {
    // 400/404는 비즈니스적으로 쿠폰 품절/미존재 등일 수 있어 테스트 실패로 보지 않음
    return { ok: true, userCouponId: null };
  }

  try {
    const body = JSON.parse(bodyText);
    const userCouponIdRaw = body?.userCouponId;
    const userCouponId =
      typeof userCouponIdRaw === 'number'
        ? userCouponIdRaw
        : typeof userCouponIdRaw === 'string'
          ? Number(userCouponIdRaw)
          : NaN;

    // userCouponId가 0일 수도 있으므로 falsy 체크 금지
    if (!Number.isFinite(userCouponId)) {
      allErrors.add(1);
      couponErrors.add(1);
      console.error(
        `coupon issue invalid 201 schema: ${String(bodyText).slice(0, 120)}`,
      );
      return { ok: false };
    }

    return { ok: true, userCouponId };
  } catch (err) {
    allErrors.add(1);
    couponErrors.add(1);
    console.error(
      `coupon issue parse error: ${err} body=${String(bodyText).slice(0, 120)}`,
    );
    return { ok: false };
  }
}

function callOrderDetail() {
  const orderId = Number.isFinite(ORDER_DETAIL_ORDER_ID)
    ? ORDER_DETAIL_ORDER_ID
    : pickOne(ORDER_DETAIL_ORDER_IDS);

  if (!orderId) {
    allErrors.add(1);
    orderDetailErrors.add(1);
    console.error('order detail skipped: no orderId available');
    return false;
  }

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '60s',
  };

  const res = http.get(`${BASE_URL}/api/orders/${orderId}`, params);

  const ok = check(res, {
    // 조회는 트래픽 생성 목적이므로, 존재하지 않는 주문(404)도 허용
    'order detail returns 200/401/404': (r) =>
      r.status === 200 || r.status === 401 || r.status === 404,
  });

  if (!ok) {
    allErrors.add(1);
    orderDetailErrors.add(1);
    console.error(
      `order detail failed: ${res.status} ${String(res.body).slice(0, 120)}`,
    );
    return false;
  }

  // 조회는 호출만 하면 되므로 바디 검증/파싱은 생략
  return true;
}

function createRandomOrder(userId) {
  // 옵션 ID를 환경변수/기본 풀에서 선택
  const productOptionId = Number.isFinite(ORDER_PRODUCT_OPTION_ID)
    ? ORDER_PRODUCT_OPTION_ID
    : pickOne(ORDER_PRODUCT_OPTION_IDS);

  if (!productOptionId) {
    allErrors.add(1);
    orderErrors.add(1);
    console.error('order skipped: no productOptionId available');
    return false;
  }

  const payload = JSON.stringify({
    userId,
    items: [{ productOptionId, quantity: 1 }],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '60s',
  };

  const res = http.post(`${BASE_URL}${CREATE_ORDER_PATH}`, payload, params);

  const ok = check(res, {
    'create order returns 201': (r) => r.status === 201,
  });

  if (!ok) {
    // 재고 부족 등은 운영상 발생 가능한 케이스이지만, 시나리오 성공률 측정 목적상 실패로 집계
    allErrors.add(1);
    orderErrors.add(1);
    console.error(
      `create order failed: ${res.status} ${String(res.body).slice(0, 120)}`,
    );
    return { ok: false };
  }

  try {
    const body = JSON.parse(res.body);
    const orderIdRaw = body?.orderId;
    const orderId =
      typeof orderIdRaw === 'number'
        ? orderIdRaw
        : typeof orderIdRaw === 'string'
          ? Number(orderIdRaw)
          : NaN;

    if (!Number.isFinite(orderId) || orderId <= 0) {
      allErrors.add(1);
      orderErrors.add(1);
      console.error(
        `create order invalid 201 schema: ${String(res.body).slice(0, 120)}`,
      );
      return { ok: false };
    }

    return { ok: true, orderId };
  } catch (err) {
    allErrors.add(1);
    orderErrors.add(1);
    console.error(
      `create order parse error: ${err} body=${String(res.body).slice(0, 120)}`,
    );
    return { ok: false };
  }
}

function processOrder({ orderId, userId, couponId }) {
  processOrderCount.add(1);

  const payloadObj = {
    userId,
    ...(Number.isFinite(couponId) && couponId > 0 ? { couponId } : {}),
  };

  const payload = JSON.stringify(payloadObj);
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '60s',
  };

  const res = http.post(
    `${BASE_URL}/api/orders/${orderId}/payment`,
    payload,
    params,
  );

  const ok = check(res, {
    // 컨트롤러는 201, openapi는 200으로 되어 있어 둘 다 허용
    'process payment returns 201 or 200': (r) =>
      r.status === 201 || r.status === 200,
  });

  if (!ok) {
    allErrors.add(1);
    paymentErrors.add(1);
    console.error(
      `process payment failed: ${res.status} ${String(res.body).slice(0, 120)}`,
    );
    return false;
  }

  // 결제는 핵심 단계지만, 바디 검증은 요구사항상 생략
  return true;
}

function pickOne(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const idx = Math.floor(Math.random() * items.length);
  return items[idx];
}
