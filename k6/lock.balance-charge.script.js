/* eslint-disable no-undef */
/**
 * Balance Charge with Lock 성능 테스트 (분산락, 비관락, 낙관락별 성능 비교)
 *
 * 사용법:
 *   # 인프라 실행
 *   pnpm infra:up
 *
 *   # 앱 실행 (락 사용은 user repo impl 코드를 알아서 수정)
 *   pnpm install && pnpm prisma generate && pnpm start:dev
 *
 *   # 테스트 실행
 *   k6 run k6/lock.balance-charge.script.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { registerTestUser, loginTestUser } from './common/setup.js';

// ** 경로 설정 **
const BASE_URL = 'http://localhost:3000';
const BALANCE_PATH = '/api/users';
const CHARGES_PER_ITERATION = Number(__ENV.CHARGES_PER_ITERATION || 3);

// ** 메트릭 정의 **
const errorCount = new Counter('errors');
const successRate = new Rate('success_rate');
const balanceAfterCharge = new Trend('balance_after_charge');
const chargeDuration = new Trend('balance_charge_duration');

// ANCHOR STEP0: [CONFIG] k6 옵션 설정
export const options = {
  scenarios: {
    balance_charge_load: {
      executor: 'ramping-vus',
      stages: [
        { duration: '10s', target: 10 }, // 워밍업: 10명까지 증가
        { duration: '30s', target: 50 }, // 부하 증가: 50명까지
        { duration: '1m', target: 100 }, // 피크: 100명 유지
        { duration: '30s', target: 50 }, // 감소: 50명으로
        { duration: '20s', target: 0 }, // 종료: 0명으로
      ],
      gracefulRampDown: '10s',
    },
  },
  summaryTrendStats: ['avg', 'min', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95%의 요청이 3초 이내
    success_rate: ['rate>0.95'], // 95% 이상 성공률
    errors: ['count<100'], // 총 에러 100개 미만
  },
};

// ANCHOR STEP1: [BEFORE] k6 set up before each VU
export function setup() {
  console.log('Starting balance charge load test with shared user...');
  const sharedUser = registerTestUser();

  if (!sharedUser) {
    throw new Error('Failed to provision shared test user');
  }

  console.log(`Shared user prepared. userId=${sharedUser.userId}`);
  return sharedUser;
}

// ANCHOR STEP2: [MAIN] k6 executed by each VU
export default function (sharedUser) {
  const userId = sharedUser.userId;

  const loginResult = loginTestUser(userId);
  if (!loginResult) {
    errorCount.add(1);
    console.error(`Login failed for shared user ${userId}`);
    sleep(1);
    return;
  }

  for (let attempt = 0; attempt < CHARGES_PER_ITERATION; attempt += 1) {
    const chargeAmount = Math.floor(Math.random() * 50000) + 10000; // 10,000 ~ 60,000원 랜덤 충전
    const { success, balance: latestBalance } = chargeBalance(
      userId,
      chargeAmount,
    );

    if (success && typeof latestBalance === 'number') {
      verifyBalance(userId, latestBalance);
    }
  }

  sleep(Math.random() * 2 + 1); // 1~3초 사이 랜덤 대기
}

// LINK - 잔액 충전 요청 실행 함수
function chargeBalance(userId, amount) {
  const payload = JSON.stringify({
    amount: amount,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.patch(
    `${BASE_URL}${BALANCE_PATH}/${userId}/balance`,
    payload,
    params,
  );

  let parsedBody = null;
  try {
    parsedBody = JSON.parse(res.body);
  } catch (err) {
    console.error('Failed to parse balance charge response body', err);
  }

  const success = check(res, {
    'balance charge status is 200': (r) => r.status === 200,
    'balance charge returns userId': () => parsedBody?.userId === userId,
    'balance charge returns balance': () =>
      typeof parsedBody?.balance === 'number',
  });

  successRate.add(success);
  chargeDuration.add(res.timings.duration);

  if (success && typeof parsedBody?.balance === 'number') {
    balanceAfterCharge.add(parsedBody.balance);
  }

  if (!success) {
    errorCount.add(1);
    console.warn(
      `Balance charge failed for userId ${userId}: ${res.status} ${res.body}`,
    );
  }

  return {
    success,
    balance:
      typeof parsedBody?.balance === 'number' ? parsedBody.balance : null,
  };
}

// LINK - 잔액 조회로 충전 검증 함수
function verifyBalance(userId, minExpectedBalance = 0) {
  const res = http.get(`${BASE_URL}${BALANCE_PATH}/${userId}/balance`);

  const success = check(res, {
    'balance verify status is 200': (r) => r.status === 200,
    'balance verify not regressed': (r) => {
      try {
        const body = JSON.parse(r.body);
        if (typeof body?.balance !== 'number') {
          return false;
        }
        return body.balance >= minExpectedBalance;
      } catch (err) {
        console.error('Failed to parse balance verify response body', err);
        return false;
      }
    },
  });

  if (!success) {
    console.warn(
      `Balance verification failed for userId ${userId}: ${res.status} ${res.body}`,
    );
  }

  return success;
}

// ANCHOR STEP3: [AFTER] k6 tear down after test
export function teardown() {
  console.log('Balance charge load test completed');
}
