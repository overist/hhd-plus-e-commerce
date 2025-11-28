/* eslint-disable no-undef */
/**
 * Top Products 캐시 성능 테스트
 *
 * 사용법:
 *   # 인프라 실행
 *   pnpm infra:up
 *
 *   # 앱 실행
 *   pnpm install && pnpm prisma generate && pnpm start:dev
 *
 *   # 테스트 실행
 *   k6 run k6/top-products-cache.script.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ** 경로 설정 **
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOP_PRODUCTS_PATH = '/api/products/top';

// ** 커스텀 메트릭 **
const requestCount = new Counter('top_products_requests');
const errorCount = new Counter('top_products_errors');
const successRate = new Rate('top_products_success_rate');
const responseTime = new Trend('top_products_response_time', true);

// ** 테스트 시나리오 **
// 환경변수로 시나리오 선택 가능: k6 run -e SCENARIO=spike ...
const SCENARIO = __ENV.SCENARIO || 'load';

const scenarios = {
  // 시나리오 1: 기본 부하 테스트 (일정 부하)
  load: {
    executor: 'constant-arrival-rate',
    rate: 100, // 초당 100 요청
    timeUnit: '1s',
    duration: '30s',
    preAllocatedVUs: 50,
    maxVUs: 200,
  },

  // 시나리오 2: 스파이크 테스트 (급증하는 트래픽)
  spike: {
    executor: 'ramping-arrival-rate',
    startRate: 10,
    timeUnit: '1s',
    preAllocatedVUs: 50,
    maxVUs: 500,
    stages: [
      { duration: '10s', target: 10 }, // 워밍업
      { duration: '10s', target: 200 }, // 스파이크
      { duration: '10s', target: 200 }, // 유지
      { duration: '10s', target: 10 }, // 정상화
    ],
  },

  // 시나리오 3: 스트레스 테스트 (점진적 부하 증가)
  stress: {
    executor: 'ramping-arrival-rate',
    startRate: 10,
    timeUnit: '1s',
    preAllocatedVUs: 50,
    maxVUs: 1000,
    stages: [
      { duration: '20s', target: 50 },
      { duration: '20s', target: 100 },
      { duration: '20s', target: 200 },
      { duration: '20s', target: 300 },
      { duration: '20s', target: 50 },
    ],
  },
};

export const options = {
  scenarios: {
    top_products: scenarios[SCENARIO],
  },
  summaryTrendStats: ['avg', 'min', 'max', 'med', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    // 캐시 적용 시 95% 요청이 100ms 이내 응답 목표
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    top_products_success_rate: ['rate>0.99'],
    top_products_errors: ['count<10'],
  },
};

// ** 셋업 **
export function setup() {
  console.log('='.repeat(60));
  console.log('Top Products Cache Performance Test');
  console.log('='.repeat(60));
  console.log(`Target URL: ${BASE_URL}${TOP_PRODUCTS_PATH}`);
  console.log(`Scenario: ${SCENARIO}`);
  console.log('');
  console.log('Compare results across different cache configurations:');
  console.log('  1. No Cache: Every request hits the database');
  console.log('  2. Memory Cache: In-memory cache with TTL');
  console.log('  3. Redis Cache: Distributed Redis cache');
  console.log('='.repeat(60));

  // 헬스체크
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    console.error(`Health check failed: ${healthRes.status}`);
    throw new Error('Aborting test due to failed health check');
  }

  // 워밍업 요청 (첫 요청은 캐시 미스)
  const warmupRes = http.get(`${BASE_URL}${TOP_PRODUCTS_PATH}`);
  console.log(`Warmup request status: ${warmupRes.status}`);

  return {
    startTime: new Date().toISOString(),
  };
}

// ** 메인 테스트 **
export default function () {
  const res = http.get(`${BASE_URL}${TOP_PRODUCTS_PATH}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // 메트릭 수집
  requestCount.add(1);
  responseTime.add(res.timings.duration);

  // 응답 검증
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        // 응답 형태: { data: [...] }
        return body.data && Array.isArray(body.data) && body.data.length > 0;
      } catch {
        return false;
      }
    },
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  if (!success) {
    errorCount.add(1);
    successRate.add(false);

    if (res.status !== 200) {
      console.error(`Request failed: ${res.status} - ${res.body}`);
    }
  } else {
    successRate.add(true);
  }

  // 현실적인 사용자 패턴: 짧은 대기
  sleep(0.1);
}

// ** 종료 핸들러 **
export function teardown(data) {
  console.log('');
  console.log('='.repeat(60));
  console.log('Test completed');
  console.log(`Started at: ${data.startTime}`);
  console.log(`Ended at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
}

// ** 결과 요약 커스터마이징 **
export function handleSummary(data) {
  const metrics = data.metrics;

  // 핵심 지표 추출
  const summary = {
    scenario: SCENARIO,
    timestamp: new Date().toISOString(),
    duration: data.state?.testRunDurationMs || 0,
    requests: {
      total: metrics.http_reqs?.values?.count || 0,
      rate: metrics.http_reqs?.values?.rate || 0,
    },
    response_time: {
      avg: metrics.http_req_duration?.values?.avg || 0,
      min: metrics.http_req_duration?.values?.min || 0,
      max: metrics.http_req_duration?.values?.max || 0,
      med: metrics.http_req_duration?.values?.med || 0,
      p90: metrics.http_req_duration?.values['p(90)'] || 0,
      p95: metrics.http_req_duration?.values['p(95)'] || 0,
      p99: metrics.http_req_duration?.values['p(99)'] || 0,
    },
    success_rate: metrics.top_products_success_rate?.values?.rate || 0,
    errors: metrics.top_products_errors?.values?.count || 0,
  };

  // 콘솔 출력용 포맷팅
  const consoleOutput = `
================================================================================
                        TOP PRODUCTS CACHE PERFORMANCE REPORT
================================================================================

Scenario: ${SCENARIO.toUpperCase()}
Duration: ${(summary.duration / 1000).toFixed(1)}s

📊 REQUEST METRICS
--------------------------------------------------------------------------------
Total Requests:     ${summary.requests.total}
Request Rate:       ${summary.requests.rate.toFixed(2)} req/s
Success Rate:       ${(summary.success_rate * 100).toFixed(2)}%
Errors:             ${summary.errors}

⏱️  RESPONSE TIME (ms)
--------------------------------------------------------------------------------
Average:            ${summary.response_time.avg.toFixed(2)}
Minimum:            ${summary.response_time.min.toFixed(2)}
Maximum:            ${summary.response_time.max.toFixed(2)}
Median:             ${summary.response_time.med.toFixed(2)}
P90:                ${summary.response_time.p90.toFixed(2)}
P95:                ${summary.response_time.p95.toFixed(2)}
P99:                ${summary.response_time.p99.toFixed(2)}

================================================================================
💡 Compare this result with other cache configurations:
   - No Cache:     Every request queries the database
   - Memory Cache: Fast but not shared across instances
   - Redis Cache:  Shared cache for distributed systems
================================================================================
`;

  return {
    stdout: consoleOutput,
    // JSON 결과 파일 저장 (비교 분석용)
    [`k6/results/top-products-${SCENARIO}-${Date.now()}.json`]: JSON.stringify(
      summary,
      null,
      2,
    ),
  };
}
