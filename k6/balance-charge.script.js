/* eslint-disable no-undef */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { registerTestUser } from './common/setup.js';

// ** 경로 설정 **
const BASE_URL = 'http://localhost:3000';
const BALANCE_PATH = '/api/users';

// ** 메트릭 정의 **
const errorCount = new Counter('errors');
const successRate = new Rate('success_rate');
const balanceAfterCharge = new Trend('balance_after_charge');

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
  console.log('Starting balance charge load test...');
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

  const userId = result.userId;
  const initialBalance = result.balance;

  // 잔액 충전 테스트
  const chargeAmount = Math.floor(Math.random() * 50000) + 10000; // 10,000 ~ 60,000원 랜덤 충전
  const chargeSuccess = chargeBalance(userId, chargeAmount);

  if (chargeSuccess) {
    // 충전 성공 후 잔액 조회로 검증
    const verifySuccess = verifyBalance(userId, initialBalance + chargeAmount);
    if (!verifySuccess) {
      console.warn(
        `Balance verification failed for userId: ${userId}, expected: ${initialBalance + chargeAmount}`,
      );
    }
  }

  // VU별로 약간의 딜레이 추가 (실제 사용자 행동 시뮬레이션)
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

  const success = check(res, {
    'balance charge status is 200': (r) => r.status === 200,
    'balance charge returns userId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body?.userId === userId;
      } catch (err) {
        console.error('Failed to parse balance charge response body', err);
        return false;
      }
    },
    'balance charge returns balance': (r) => {
      try {
        const body = JSON.parse(r.body);
        const hasBalance = typeof body?.balance === 'number';
        if (hasBalance) {
          balanceAfterCharge.add(body.balance);
        }
        return hasBalance;
      } catch (err) {
        console.error('Failed to parse balance charge response body', err);
        return false;
      }
    },
  });

  successRate.add(success);

  if (!success) {
    errorCount.add(1);
    console.warn(
      `Balance charge failed for userId ${userId}: ${res.status} ${res.body}`,
    );
  }

  return success;
}

// LINK - 잔액 조회로 충전 검증 함수
function verifyBalance(userId, expectedBalance) {
  const res = http.get(`${BASE_URL}${BALANCE_PATH}/${userId}/balance`);

  const success = check(res, {
    'balance verify status is 200': (r) => r.status === 200,
    'balance verify matches expected': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body?.balance === expectedBalance;
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
export function teardown(data) {
  console.log('Balance charge load test completed');
}
