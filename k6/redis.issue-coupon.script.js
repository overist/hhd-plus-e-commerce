/* eslint-disable no-undef */
/**
 * Issue Coupon 성능 테스트
 *
 * 사용법:
 *   # 인프라 실행
 *   pnpm infra:up:stage
 *
 *   # 테스트 실행
K6_OUT=influxdb=http://admin:admin1234@210.124.110.5:8086/k6 \
k6 run k6/redis.issue-coupon.script.js \
-e SCENARIO=peak \
-e BASE_URL=http://210.124.110.5:3000

* 참고:
 * - stage 환경(`NODE_ENV=stage`)에서는 AuthGuard가 우회되어 세션 없이 호출 가능합니다.
 */

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// ** 경로 설정 **
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const COUPON_ID = 1;
const COUPON_PATH = '/api/coupons';

// ** 메트릭 정의 **
const errorCount = new Counter('errors_coupon_issue');
const soldoutCount = new Counter('coupon_sold_out_count');
const duplicateCount = new Counter('coupon_duplicate_issue_count');
const networkErrorCount = new Counter('network_errors_coupon_issue');
const successRate = new Rate('success_coupon_issue_rate');

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
    duration: '20m', // 장기간 테스트
    preAllocatedVUs: 1000,
    maxVUs: 1000,
  },

  // Stress Test (스트레스 테스트)
  // 점진적으로 부하를 증가시켜 한계점 및 확장성 평가
  stress: {
    executor: 'ramping-arrival-rate',
    startRate: 10,
    timeUnit: '1s',
    preAllocatedVUs: 4000,
    maxVUs: 4000,
    stages: [
      { duration: '5s', target: 1000 }, // 워밍업
      { duration: '30s', target: 2000 }, // 부하 임계점 1 측정
      { duration: '30s', target: 3000 }, // 부하 임계점 2 측정
      { duration: '30s', target: 4000 }, // 부하 임계점 3 측정
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
      { duration: '10s', target: 1500 }, // 최고 부하 점진적으로 증가
      { duration: '120s', target: 1500 }, // 최고 부하 지속
    ],
  },
};

// ANCHOR STEP0: [CONFIG] k6 옵션 설정
export const options = {
  scenarios: {
    issue_coupon: scenarios[SCENARIO],
  },
  summaryTrendStats: ['avg', 'min', 'max', 'p(55)', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    success_coupon_issue_rate: ['rate>0.99'],
  },
};

// ANCHOR STEP1: [BEFORE] k6 set up before each VU
export function setup() {
  console.log(`Coupon ID: ${COUPON_ID}`);
  return {};
}

// ANCHOR STEP2: [MAIN] k6 executed by each VU
export default function () {
  const userId = Math.floor(Math.random() * 1000000000000000);
  // console.log(`VU:${__VU} ITER:${__ITER} => userId:${userId}`);
  issueCoupon(userId);
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
    timeout: '60s',
  };

  const res = http.post(
    `${BASE_URL}${COUPON_PATH}/${COUPON_ID}/issue`,
    payload,
    params,
  );

  // 응답 헤더/본문 점검
  const contentType =
    (res.headers &&
      (res.headers['Content-Type'] || res.headers['content-type'])) ||
    '';
  const bodyText = res.body ?? '';
  const looksLikeHtml =
    typeof bodyText === 'string' && bodyText.trimStart().startsWith('<');

  // 네트워크/게이트웨이 수준의 비정상 응답(본문이 HTML 에러 페이지 혹은 Content-Type 비정상)은 별도로 집계
  if (!contentType.includes('application/json') || looksLikeHtml) {
    errorCount.add(1);
    networkErrorCount.add(1);
    console.error(
      `Non-JSON/network response: status=${
        res.status
      } content-type=${contentType} body-prefix=${String(bodyText).slice(
        0,
        80,
      )}`,
    );
    successRate.add(false);
    return false;
  }

  // 비즈니스 규칙으로 '정상'으로 간주할 케이스들
  if (res.status === 422) {
    // 품절
    soldoutCount.add(1);
    successRate.add(true);
    check(res, {
      'coupon issue returns 422 when sold out': (r) => r.status === 422,
    });
    return true;
  }

  if (typeof bodyText === 'string' && bodyText.includes('이미 발급된 쿠폰')) {
    // 중복 발급
    duplicateCount.add(1);
    successRate.add(true);
    check(res, {
      'coupon issue returns duplicate message when already issued': (r) =>
        r.status === 400,
    });
    return true;
  }

  // 정상 성공(201)인 경우에만 JSON 파싱 및 스키마 검증
  if (res.status === 201) {
    try {
      const body = JSON.parse(bodyText);
      const ok = 'userCouponId' in body && Boolean(body?.couponName);
      if (ok) {
        successRate.add(true);
        check(res, {
          'coupon issue returns valid schema on 201': (r) => r.status === 201,
        });

        return true;
      }
      // 응답이 201인데 스키마가 맞지 않으면 실패로 집계
      errorCount.add(1);
      console.error(
        `Invalid schema on 201: body-prefix=${String(bodyText).slice(0, 120)}`,
      );
      successRate.add(false);
      return false;
    } catch (err) {
      errorCount.add(1);
      console.error(
        `parse error on 201: ${err} body-prefix=${String(bodyText).slice(
          0,
          120,
        )}`,
      );
      successRate.add(false);
      return false;
    }
  }

  // 그 밖의 HTTP 상태(4xx/5xx 등)는 실패로 집계
  errorCount.add(1);
  console.error(
    `Coupon issue failed: ${res.status} ${String(bodyText).slice(0, 120)}`,
  );
  successRate.add(false);
  return false;
}
