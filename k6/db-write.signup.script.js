/* eslint-disable no-undef */
/**
 * Signup 성능 테스트 (DB Insert 부하 측정)
 *
 * 사용법:
 *   pnpm infra:up:stage
 *   k6 run k6/signup.script.js -e SCENARIO=peak
 */

import http from 'k6/http';
import { check, error } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const signupErrors = new Counter('errors');
const signupSuccessRate = new Rate('signup_success_rate');

// ** 테스트 시나리오 **
// 환경변수로 시나리오 선택 가능: k6 run -e SCENARIO=stress ...
const SCENARIO = __ENV.SCENARIO || 'peak';

const scenarios = {
  // Load Test (부하 테스트)
  // 예상되는 부하를 제한된 시간 동안 제공하여 정상 처리 확인
  load: {
    executor: 'constant-arrival-rate',
    rate: 100, // 초당 100 요청
    timeUnit: '1s',
    duration: '30s',
    preAllocatedVUs: 100,
    maxVUs: 100,
  },

  // Endurance Test (내구성 테스트)
  // 동일한 부하를 장시간 유지하여 메모리 누수 등 장기 이슈 탐지
  endurance: {
    executor: 'constant-arrival-rate',
    rate: 1000, // 초당 1000 요청으로 장시간 유지
    timeUnit: '1s',
    duration: '10m', // 장기간 테스트
    preAllocatedVUs: 1000,
    maxVUs: 1000,
  },

  // Stress Test (스트레스 테스트)
  // 점진적으로 부하를 증가시켜 한계점 및 확장성 평가
  stress: {
    executor: 'ramping-arrival-rate',
    startRate: 10,
    timeUnit: '1s',
    preAllocatedVUs: 3000,
    maxVUs: 3000,
    stages: [
      { duration: '60s', target: 1000 }, // 부하 임계점 1 측정
      { duration: '60s', target: 2000 }, // 부하 임계점 2 측정
      { duration: '60s', target: 3000 }, // 부하 임계점 3 측정
    ],
  },

  // Peak Test (최고 부하 테스트)
  // 짧은 시간 동안 임계치에 해당하는 대량의 트래픽을 순간적으로 발생
  peak: {
    executor: 'ramping-arrival-rate',
    startRate: 10,
    timeUnit: '1s',
    preAllocatedVUs: 4000,
    maxVUs: 4000,
    stages: [
      { duration: '10s', target: 1000 }, // 워밍업
      { duration: '10s', target: 1000 }, // 최고 부하 점진적으로 증가
      { duration: '120s', target: 1000 }, // 최고 부하 지속
    ],
  },
};

// ANCHOR STEP0: [CONFIG] k6 옵션 설정
export const options = {
  scenarios: {
    signup_db_insert: scenarios[SCENARIO],
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    signup_success_rate: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'min', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ANCHOR STEP1: [BEFORE] k6 set up before each VU
export function setup() {
  return {};
}

// ANCHOR STEP2: [MAIN] k6 executed by each VU
export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/api/auth/signup`, null, params);

  const success = check(res, {
    'signup returns 201': (r) => r.status === 201,
    'body contains userId': (r) => {
      try {
        const parsed = JSON.parse(r.body);
        return !!parsed.userId;
      } catch (err) {
        return false;
      }
    },
  });

  if (!success) {
    signupErrors.add(1);
    error(`signup failed: ${res.status} ${res.body}`);
    console.error(`signup failed: ${res.status} ${res.body}`);
  }

  signupSuccessRate.add(success);
}
