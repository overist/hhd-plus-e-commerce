# k6 부하테스트 가이드

## 시작하기

- 경합이 발생하는 API에 대해 p55, p95, p99 응답시간 목표치를 설정하고, 스모크 테스트를 실행합니다.
- 사전 설치 명령어로 k6 바이너리를 호스트에 설치한 뒤 사용합니다.
- 가상 환경 비권장, 하드웨어가 격리된 환경에서 테스트를 권장합니다.
- 프로덕션 사양과 동등하거나 그보다 낮은 수준의 STAGE 서버를 구성하여 테스트를 권장합니다.

## 사전 설치 명령어

### Windows

```powershell
choco install k6
```

### macOS

```bash
brew install k6
```

### CI (Docker 기반)

```bash
docker pull grafana/k6
```

GitHub Actions 예:

```yaml
- uses: grafana/k6-action@v0.2.0
	 with:
		 filename: test/k6/minimal-smoke.test.js
		 flags: --env K6_TARGET_URL=${{ env.K6_TARGET_URL }}
```

## 실행

### 잔액 충전 부하 테스트

```bash
k6 run k6/balance-charge.script.js
```

---

# 10대 서버 스케일아웃 분산락 부하 테스트 가이드

## 개요

이 문서는 **10대 NestJS 서버 + 1대 Redis** 환경에서 Redlock + Pub/Sub 기반 분산락의 부하 내성을 테스트하는 방법을 설명합니다.

## 테스트 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                         K6 Load Tester                          │
│                   (constant-arrival-rate 방식)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Nginx Load Balancer                        │
│                     (least_conn strategy)                       │
└─────────────────────────────────────────────────────────────────┘
          │         │         │         │         │
          ▼         ▼         ▼         ▼         ▼
     ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
     │ App 1 │ │ App 2 │ │ App 3 │ │  ...  │ │App 10 │
     └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘
         │         │         │         │         │
         └─────────┴─────────┴────┬────┴─────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │      Redis (Lock)     │
                    │   - Redlock (분산락)    │
                    │   - Pub/Sub (락 해제)   │
                    │   - Session Store       │
                    └─────────────────────────┘
```

## 사전 요구사항

- Docker & Docker Compose
- K6 (`brew install k6` 또는 https://k6.io/docs/get-started/installation/)
- 충분한 시스템 리소스 (10개 컨테이너 실행을 위해 최소 8GB RAM 권장)

## 테스트 실행 방법

### Step 1: Docker 이미지 빌드

```bash
docker build -t hhplus-ecommerce .
```

### Step 2: 10대 서버 + 인프라 실행

```bash
docker compose -f docker-compose.stage.yaml up --scale app=10 -d
```

실행 확인:

```bash
docker compose -f docker-compose.stage.yaml ps
```

예상 출력:

```
NAME                       SERVICE         STATUS
scale-mysql                mysql           running (healthy)
scale-redis-session        redis-session   running (healthy)
scale-redis-lock           redis-lock      running (healthy)
scale-redis-cache          redis-cache     running (healthy)
scale-nginx                nginx           running
hhplus-e-commerce-app-1    app             running
hhplus-e-commerce-app-2    app             running
...
hhplus-e-commerce-app-10   app             running
```

### Step 3: K6 부하 테스트 실행

```bash
# 쿠폰 발급 동시성 테스트
k6 run k6/issue-coupon.script.js

# 또는 커스텀 VU/Duration 설정
k6 run --vus 200 --duration 60s k6/issue-coupon.script.js
```

### Step 4: 결과 분석

K6 출력에서 확인할 항목:

- `http_req_duration`: 요청 처리 시간 (p95 < 3s 목표)
- `success_coupon_issue_rate`: 쿠폰 발급 성공률
- `success_register_rate`: 회원가입 성공률 (> 99% 목표)
- `errors_coupon_issue`: 쿠폰 발급 에러 수
- `coupon_sold_out_count`: 품절로 인한 실패 수 (예상된 동작)

Redis 부하 확인:

```bash
# 분산 락 Redis 확인
docker exec scale-redis-lock redis-cli INFO stats | grep -E "(commands|connections)"

# 캐시 Redis 확인
docker exec scale-redis-cache redis-cli INFO stats | grep -E "(commands|connections)"

# 세션 Redis 확인
docker exec scale-redis-session redis-cli INFO stats | grep -E "(commands|connections)"
```

### Step 5: 종료

```bash
docker compose -f docker-compose.stage.yaml down
```

## 테스트 시나리오

### 현재 K6 스크립트 동작 방식

`k6/issue-coupon.script.js`는 다음과 같이 동작합니다:

1. **각 VU(Virtual User)가 iteration마다**:
   - 새 사용자 회원가입 (`POST /api/auth/signup`)
   - 해당 세션으로 쿠폰 발급 요청 (`POST /api/coupons/{id}/issue`)

2. **세션 관리**: K6가 동일 VU 내에서 쿠키를 자동 유지하므로, 회원가입 후 같은 세션으로 쿠폰 발급

3. **설정 (기본값)**:
   ```javascript
   rate: 25,              // 초당 25개 iteration
   duration: '5s',        // 5초 동안
   preAllocatedVUs: 100,  // 미리 할당할 VU 수
   maxVUs: 100,           // 최대 VU 수
   ```

### 1. 쿠폰 발급 동시성 테스트 (기본)

```bash
k6 run k6/issue-coupon.script.js
```

- 여러 VU가 동시에 같은 쿠폰(COUPON_ID=1) 발급 요청
- Redlock이 순차 처리를 보장하는지 확인
- Pub/Sub으로 락 해제 시 대기 중인 요청이 빠르게 재시도하는지 확인

### 2. 선착순 수량 한정 테스트

쿠폰 수량을 100개로 제한하고, 더 많은 요청 시도:

- 정확히 100명만 성공해야 함
- 나머지는 품절 에러 (errorCode: C001)

### 3. 커스텀 부하 테스트

```bash
# VU 수와 지속 시간 조정
k6 run --vus 200 --duration 60s k6/issue-coupon.script.js
```

### 4. 장시간 안정성 테스트

```bash
k6 run --vus 50 --duration 10m k6/issue-coupon.script.js
```

- 메모리 누수 확인
- Redis 연결 풀 안정성
- Pub/Sub 채널 구독 누적 여부

## 예상 결과

### Pub/Sub 적용 전 (Polling 방식)

```
scenarios: (100.00%) 1 scenario, 100 max VUs, 35s max duration

     ✗ success_coupon_issue_rate...: 75.2%
     ✓ http_req_duration...........: avg=1.2s min=50ms max=5s p(95)=3.5s
     ✗ errors_coupon_issue.........: 248
```

- Redis `SETNX` 폴링으로 인한 높은 지연
- 락 경쟁 시 재시도 오버헤드

### Pub/Sub 적용 후

```
scenarios: (100.00%) 1 scenario, 100 max VUs, 35s max duration

     ✓ success_coupon_issue_rate...: 95.8%
     ✓ success_register_rate.......: 100%
     ✓ http_req_duration...........: avg=180ms min=30ms max=800ms p(95)=500ms
     ✗ errors_coupon_issue.........: 42
     coupon_sold_out_count.........: 83
```

- 락 해제 이벤트로 즉시 재시도
- Redis 명령 수 80% 감소
- 평균 응답 시간 85% 개선
- `coupon_sold_out_count`: 정상적인 품절 응답 (에러가 아닌 정상 케이스)

## 트러블슈팅

### 컨테이너가 시작되지 않음

```bash
docker compose -f docker-compose.stage.yaml logs app
```

### Redis 연결 실패

```bash
# 각 Redis 인스턴스 확인
docker exec scale-redis-session redis-cli ping
docker exec scale-redis-lock redis-cli ping
docker exec scale-redis-cache redis-cli ping
```

### 세션 문제 (401 Unauthorized)

K6 테스트에서 401 에러가 발생하면:

1. **같은 VU 내에서 회원가입과 쿠폰 발급을 순차 실행해야 합니다**
   - K6의 `setup()` 함수와 `default()` 함수는 별도의 JavaScript 컨텍스트에서 실행됨
   - `setup()`에서 생성한 세션 쿠키를 VU에서 공유할 수 없음
2. **현재 스크립트 해결 방식**: 각 VU가 회원가입 → 쿠폰 발급을 순차 실행
   - 같은 VU 내에서는 쿠키가 자동으로 유지됨 (`jar.cookiesForURL()` 사용)

3. **Nginx 세션 전달 확인**:

```bash
curl -v -c cookies.txt -b cookies.txt http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "1234"}'
```

### K6 스크립트 실행 오류

```bash
# K6가 설치되어 있는지 확인
k6 version

# 스크립트 문법 확인
k6 run --dry-run k6/issue-coupon.script.js
```

## 모니터링 (선택)

Prometheus + Grafana 추가 시 실시간 대시보드 구성 가능:

- Redis 명령 수/초
- 앱 인스턴스별 요청 분포
- Pub/Sub 메시지 처리량
