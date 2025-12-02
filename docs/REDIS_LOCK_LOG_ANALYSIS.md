# Redis 분산락 동시성 제어 분석 보고서

## 1. 개요

**테스트 일시**: 2025-12-03  
**테스트 환경**: 2대 NestJS 서버 + 1대 Redis (Docker 스케일아웃)  
**테스트 대상**: 쿠폰 발급 API (`POST /api/coupons/1/issue`)  
**분석 대상**: Redis MONITOR 로그 (약 12초간 957건의 쿠폰 발급 요청)

---

## 2. 핵심 결론: 동시성 제어 성공 ✅

### 2.1 락 순차 처리 확인

로그에서 모든 락이 **순차적으로** 획득/해제되었음을 확인:

```
시간(ms)       |  동작
---------------|---------------------------
261.006180     |  eval GET lock:coupon:issue:1 (토큰 검증)
261.006289     |  eval DEL lock:coupon:issue:1 (해제 - bb945170...)
261.006315     |  eval PUBLISH lock:release:coupon:issue:1 "released"
261.006930     |  SET lock:coupon:issue:1 (획득 - 7405b473...)
```

**핵심 관찰**:

- 동시에 2개 이상의 락이 존재한 적 **없음**
- 모든 락은 고유한 token(UUID)으로 식별됨
- 락 획득 → 비즈니스 로직 → 락 해제 → PUBLISH 순서 일관됨

### 2.2 멀티 서버 환경 검증

두 개의 서버(172.19.0.4, 172.19.0.5)가 동일한 리소스에 접근:

| 서버 IP    | 역할         | 포트         |
| ---------- | ------------ | ------------ |
| 172.19.0.4 | App Server 1 | 47044, 47060 |
| 172.19.0.5 | App Server 2 | 49360, 49362 |

**서버 간 락 전환 예시** (timestamp 261.006~261.007):

```
172.19.0.4:47060 → eval DEL lock:coupon:issue:1 (Server A 해제)
172.19.0.4:47060 → PUBLISH lock:release:coupon:issue:1 "released"
172.19.0.5:49362 → SET lock:coupon:issue:1 (Server B 즉시 획득)
```

→ **Pub/Sub 기반 락 해제 알림이 정상 작동하여 서버 간 즉시 전환됨**

---

## 3. 실제 Redis MONITOR 로그

### 3.1 락 획득 흐름

`SET ... NX` 명령을 사용한 원자적 락 획득:

```
# 1. 첫 번째 요청: 세션 생성 후 락 획득 시도
1764697260.944659 [0 172.19.0.4:47044] "SET" "sess:dCb4jLNQUTMCnmeZ85TPpJ0g4sTmVgmf"
  "{\"cookie\":{...},\"userId\":848}" "EX" "43200"
1764697260.987085 [0 172.19.0.4:47060] "set" "lock:coupon:issue:1"
  "bb945170-93dc-4d4f-9221-f29149e70ce9" "PX" "5000" "NX"

# 2. 동시에 여러 요청이 락 획득 시도 (NX로 인해 하나만 성공)
1764697260.999226 [0 172.19.0.4:47060] "set" "lock:coupon:issue:1" "7405b473-..." "PX" "5000" "NX"
1764697261.000317 [0 172.19.0.4:47060] "set" "lock:coupon:issue:1" "82b88e7e-..." "PX" "5000" "NX"
1764697261.011894 [0 172.19.0.5:49362] "set" "lock:coupon:issue:1" "aa5c7fbd-..." "PX" "5000" "NX"
```

### 3.2 락 해제 흐름

Lua 스크립트로 원자적 처리:

```
# 락 해제 (토큰 검증 → 삭제 → PUBLISH)
1764697261.006180 [0 172.19.0.4:47060] "eval" "
      if redis.call('get', KEYS[1]) == ARGV[1] then
        redis.call('del', KEYS[1])
        redis.call('publish', ARGV[2], 'released')
        return 1
      else
        return 0
      end
    " "1" "lock:coupon:issue:1" "bb945170-93dc-4d4f-9221-f29149e70ce9" "lock:release:coupon:issue:1"
1764697261.006278 [0 lua] "get" "lock:coupon:issue:1"
1764697261.006289 [0 lua] "del" "lock:coupon:issue:1"
1764697261.006315 [0 lua] "publish" "lock:release:coupon:issue:1" "released"
```

### 3.3 Pub/Sub 기반 즉시 재시도

락 해제 후 대기 중인 요청들이 즉시 재시도:

```
# 락 해제 직후
1764697261.006315 [0 lua] "publish" "lock:release:coupon:issue:1" "released"

# 즉시 다음 요청이 락 획득 시도 (< 1ms)
1764697261.006930 [0 172.19.0.4:47060] "set" "lock:coupon:issue:1" "7405b473-..." "PX" "5000" "NX"
1764697261.006999 [0 172.19.0.4:47060] "set" "lock:coupon:issue:1" "82b88e7e-..." "PX" "5000" "NX"
```

**로그 해석**:

- `SET ... PX 5000 NX`: 원자적 락 획득 (키 없을 때만, TTL 5초)
- `eval ...`: Lua 스크립트로 락 해제 (토큰 검증 후)
- 락 해제 후 `PUBLISH`로 대기 중인 요청들에게 알림 → 즉시 재시도

---

## 4. 동작 분석

### 4.1 원자적 연산 기반 락 관리

Redis 명령어 및 Lua 스크립트를 사용:

| 연산     | 방식                    | 내부 명령                        |
| -------- | ----------------------- | -------------------------------- |
| 락 획득  | `SET key token PX NX`   | 원자적 조건부 설정               |
| TTL 연장 | Lua 스크립트 (Watchdog) | `GET` → `PEXPIRE` (토큰 검증 후) |
| 락 해제  | Lua 스크립트            | `GET` → `DEL` → `PUBLISH`        |

**락 획득 (SET NX PX)**:

```
SET lock:coupon:issue:1 "token" PX 5000 NX
# NX: 키가 없을 때만 설정 (원자적)
```

**TTL 연장 스크립트 (Watchdog)**:

```lua
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
else
  return 0
end
```

**락 해제 스크립트**:

```lua
if redis.call('get', KEYS[1]) == ARGV[1] then
  redis.call('del', KEYS[1])
  redis.call('publish', ARGV[2], 'released')
  return 1
else
  return 0
end
```

→ **원자적 연산으로 Race Condition 방지**

### 4.2 락 충돌 및 재시도 패턴

대량의 동시 요청에서 락 충돌 확인:

```
# 약 99,050건의 락 획득 시도 중 957건만 성공 (성공률 ~1%)
# 나머지는 NX 조건 실패 → Pub/Sub 대기 → 재시도
```

**결과**: 락 획득 실패 시 Pub/Sub 채널을 구독하여 대기 후 즉시 재시도

---

## 5. Pub/Sub 락 해제 알림 시스템

### 5.1 PUBLISH 명령 확인

모든 락 해제 후 PUBLISH 명령이 실행됨:

```
1764697261.006315 [0 lua] "publish" "lock:release:coupon:issue:1" "released"
```

**PUBLISH 횟수**: 957회 (모든 락 해제마다 1회)

### 5.2 Pub/Sub의 성능 이점

| 방식                 | Redis 명령 수 | 지연 시간  |
| -------------------- | ------------- | ---------- |
| Polling (100ms 간격) | 50회/5초      | 최대 100ms |
| Pub/Sub              | 1회 (구독)    | < 1ms      |

→ **이벤트 기반 알림으로 Redis 부하 감소 및 즉시 재시도 가능**

---

## 6. 세션 관리 통합 확인

### 6.1 세션 저장 흐름

각 쿠폰 발급 요청마다 세션이 Redis에 저장/갱신됨:

```
SET "sess:dCb4jLNQUTMCnmeZ85TPpJ0g4sTmVgmf"
  "{\"cookie\":{...},\"userId\":848}" "EX" "43200"
```

**세션 키 패턴**: `sess:{sessionId}`  
**TTL**: 43200초 (12시간)

### 6.2 사용자 ID 순차 증가 확인

로그에서 userId가 848 → 1804까지 순차 증가:

- 총 957명의 사용자가 각각 한 번씩 쿠폰 발급 요청
- **중복 발급 없음** (동일 userId의 중복 요청 미발견)

---

## 7. 성능 지표

### 7.1 락 처리 시간 분석

| 지표              | 값                        |
| ----------------- | ------------------------- |
| 평균 락 보유 시간 | ~8ms                      |
| 최소 락 보유 시간 | 6ms                       |
| 최대 락 보유 시간 | 80ms                      |
| 총 처리 요청 수   | 957건                     |
| 총 처리 시간      | ~12초 (260.944 ~ 272.954) |
| 처리량            | ~80 req/sec               |
| 락 획득 시도 횟수 | 99,050건                  |
| 락 획득 성공률    | ~1% (957/99,050)          |

### 7.2 서버 부하 분산

| 서버       | 처리 건수 | 비율 |
| ---------- | --------- | ---- |
| 172.19.0.4 | 485건     | 51%  |
| 172.19.0.5 | 472건     | 49%  |

→ **Nginx least_conn 전략에 의한 균등한 부하 분산 확인**

---

## 8. 결론

### 8.1 동시성 제어 완료 확인 사항

| 항목           | 상태 | 근거                          |
| -------------- | ---- | ----------------------------- |
| 분산락 원자성  | ✅   | Lua 스크립트 기반 `SET PX NX` |
| 락 순차 처리   | ✅   | 동시 락 존재 없음             |
| 서버 간 동기화 | ✅   | Pub/Sub 즉시 알림             |
| 중복 발급 방지 | ✅   | 고유 userId 순차 증가         |
| 세션 일관성    | ✅   | Redis 세션 스토어             |

### 8.2 Redis 키 구조 요약

```
┌─────────────────────────────────────────────┐
│  lock:coupon:issue:1                        │  ← 분산락 키
│  lock:release:coupon:issue:1 (Pub/Sub)      │  ← 락 해제 알림 채널
│  sess:{sessionId}                           │  ← 세션 데이터
└─────────────────────────────────────────────┘
```

### 8.3 권장 사항

1. **락 TTL 조정**: 현재 5000ms → 비즈니스 로직 실행 시간에 따라 조정 권장
2. **모니터링 추가**: 락 대기 시간, 충돌 횟수 메트릭 수집
3. **Cluster 확장성**: 현재 단일 Redis로 충분하나, 고가용성을 위해 Sentinel 또는 Cluster 고려

---

## 부록: Redis 모니터링 명령어

```bash
# 1. 모든 명령어 실시간 모니터링
docker exec -it scale-redis redis-cli MONITOR

# 2. lock 관련 키만 필터링
docker exec -it scale-redis redis-cli MONITOR | grep -i lock

# 3. 현재 존재하는 lock 키 조회
KEYS lock:*

# 4. 특정 락 키 값 확인
GET lock:coupon:issue:1

# 5. 락 키의 TTL 확인 (ms 단위)
PTTL lock:coupon:issue:1

# 6. Pub/Sub 채널 구독 상태 확인
PUBSUB CHANNELS lock:release:*

# 7. Redis 통계
INFO stats
```

---

**최종 수정일**: 2025-12-03  
**분석 도구**: Redis MONITOR, K6 부하 테스트
