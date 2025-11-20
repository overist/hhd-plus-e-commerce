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
const errorCount = new Counter('errors');
const successRate = new Rate('success_rate');

// ANCHOR STEP0: [CONFIG] k6 옵션 설정
export const options = {
  scenarios: {
    coupon_spike: {
      executor: 'ramping-vus',
      stages: [
        { duration: '10s', target: 20 },
        { duration: '30s', target: 100 },
        { duration: '10s', target: 20 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  summaryTrendStats: ['avg', 'min', 'max', 'p(55)', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    success_rate: ['rate>0.8'],
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
    errorCount.add(1);
    console.error('User registration failed');
    return;
  }

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
    'coupon issue returns id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Boolean(body?.data?.id);
      } catch (err) {
        console.error('Failed to parse coupon issue response body', err);
        return false;
      }
    },
  });

  successRate.add(success);

  if (!success) {
    errorCount.add(1);
    console.warn(`Coupon issue failed: ${res.status} ${res.body}`);
  }

  return success;
}
