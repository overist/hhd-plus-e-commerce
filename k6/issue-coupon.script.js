/* eslint-disable no-undef */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { registerTestUser } from './common/setup.js';

// ** 경로 설정 **
const BASE_URL = 'http://localhost:3000';
const COUPON_ID = 1;
const COUPON_PATH = '/api/coupons';

// ** 메트릭 정의 **
const errorUserCount = new Counter('error_register_user');
const successUserRate = new Rate('success_register_rate');
const errorCount = new Counter('errors_coupon_issue');
const souldoutCount = new Counter('coupon_sold_out_count');
const successRate = new Rate('success_coupon_issue_rate');

// ANCHOR STEP0: [CONFIG] k6 옵션 설정
export const options = {
  scenarios: {
    coupon_spike: {
      executor: 'constant-arrival-rate',
      rate: 50, // 초당 요청 수
      timeUnit: '1s',
      duration: '5s',
      preAllocatedVUs: 100, // 미리 할당할 VU 수
      maxVUs: 100, // 최대 VU 수
    },
  },
  summaryTrendStats: ['avg', 'min', 'max', 'p(55)', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    success_register_rate: ['rate>0.99'],
    success_coupon_issue_rate: ['rate>0.99'],
  },
};

// ANCHOR STEP1: [BEFORE] k6 set up before each VU
export function setup() {
  console.log(`Coupon ID: ${COUPON_ID}`);
  console.log('Each VU will create its own user session');
  return {};
}

// ANCHOR STEP2: [MAIN] k6 executed by each VU
export default function () {
  // 각 VU마다 새 사용자를 생성하고 세션을 받음
  const result = registerTestUser();
  if (!result) {
    errorUserCount.add(1);
    console.error('User registration failed');
    return;
  }
  successUserRate.add(true);

  // 세션 쿠키는 k6가 자동으로 관리
  issueCoupon(result.userId);
}

// LINK - 쿠폰 발급 요청 실행 함수
function issueCoupon(userId) {
  const payload = JSON.stringify({
    userId: userId,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(
    `${BASE_URL}${COUPON_PATH}/${COUPON_ID}/issue`,
    payload,
    params,
  );

  const success = check(res, {
    'coupon issue status is 201': (r) => r.status === 201,
    'coupon issue returns userCouponId': (r) => {
      try {
        const body = JSON.parse(r.body);
        // 응답 구조: { userCouponId, couponName, discountRate, expiredAt }
        return Boolean(body?.userCouponId);
      } catch (err) {
        console.error('Failed to parse coupon issue response body', err);
        return false;
      }
    },
  });

  successRate.add(success);

  if (!success) {
    errorCount.add(1);
    // 품절(422)은 예상된 동작이므로 warn 대신 info로 표시
    if (res.body?.errorCode === 'C001') {
      console.info(`Coupon sold out: ${res.body}`);
      souldoutCount.add(1);
    } else {
      console.warn(`Coupon issue failed: ${res.status} ${res.body}`);
      errorCount.add(1);
    }
  }

  return success;
}
