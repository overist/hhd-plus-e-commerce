# 🛒 HHPlus E-Commerce

NestJS 기반 이커머스 백엔드 시스템

## 🚀 기술 스택

- **Framework**: NestJS
- **Database**: MySQL 8.0 (InnoDB, MVCC)
- **ORM**: Prisma
- **Cache/Lock**: Redis (3개 분리 구성)
  - Session: 세션 저장 (express-session)
  - Lock: 분산 락 (Redlock + Pub/Sub)
  - Cache: API 응답 캐시 (@nestjs/cache-manager)
- **Testing**: Jest, Testcontainers

---

## 📁 폴더 구조

```
src/
├── @auth/                    # 인증 모듈 (추후 서버리스로 분리 가능)
├── @schedulers/              # 배치 스케줄러 (추후 분리 가능)
├── @common/                  # 공통 모듈
│   ├── exception/            # 도메인/검증 예외 필터
│   ├── guards/               # 인증 가드
│   ├── mutex-manager/        # 분산 락 관리자
│   ├── redis-manager/        # Redis 연결 관리
│   ├── cache-manager/        # API 응답 캐시 관리
│   └── prisma-manager/       # Prisma 트랜잭션 컨텍스트
│
├── cart/                     # 장바구니 도메인 모듈
│   ├── cart.module.ts
│   ├── application/          # UseCase + Application DTO
│   ├── domain/               # Entity + DomainService + Repository Interface
│   ├── infrastructure/       # Repository 구현체
│   └── presentation/         # Controller + Presentation DTO
│
├── coupon/                   # 쿠폰 도메인 모듈 (동일 구조)
├── order/                    # 주문 도메인 모듈 (동일 구조)
├── product/                  # 상품 도메인 모듈 (동일 구조)
├── user/                     # 사용자 도메인 모듈 (동일 구조)
│
├── app.module.ts
└── main.ts
```

> 📖 **상세 아키텍처 문서**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## 🎯 설계 원칙

### 계층별 역할

| 계층               | 역할                           | 주요 구성 요소                              |
| ------------------ | ------------------------------ | ------------------------------------------- |
| **Presentation**   | HTTP 요청/응답, 유효성 검증    | Controller, Request/Response DTO            |
| **Application**    | 유즈케이스 실행, 트랜잭션 경계 | UseCase, Command/Query/Result DTO           |
| **Domain**         | 핵심 비즈니스 규칙             | Entity, DomainService, Repository Interface |
| **Infrastructure** | 외부 시스템 연동               | Repository 구현체 (Prisma)                  |

### DTO 패턴

```
Presentation DTO          Application DTO
─────────────────         ─────────────────
AddCartRequest     →      AddCartCommand      (toCommand)
AddCartResponse    ←      AddCartResult       (fromDomain)
```

- **CQRS 패턴**: Command(변경) vs Query(조회) 분리
- **1 UseCase = 1 DTO**: 단일 책임 원칙 적용

### Rich Domain Model

```typescript
// 비즈니스 규칙이 엔티티 내부에 존재
export class CartItem {
  increaseQuantity(amount: number): void { ... }
  validateOwnership(userId: number): void { ... }
  shouldBeRemoved(): boolean { ... }
}
```

---

## ⏰ 배치 스케줄러

| 스케줄러         | 주기      | 설명                                  |
| ---------------- | --------- | ------------------------------------- |
| 인기 상품 스냅샷 | 매일 자정 | 최근 3일간 판매량 Top 5 집계          |
| 주문 만료 처리   | 30초마다  | 10분 미결제 주문 자동 만료, 재고 해제 |

> ⚠️ 현재 배치 스케줄러는 **단일 서버 인스턴스**에서만 안전하게 작동합니다. 분산 환경 적용시 외부 스케쥴러로 전환해야 합니다.

---

## 🔒 동시성 제어

### MySQL InnoDB + MVCC 기반 구현

현재 시스템은 **MySQL 8.0 InnoDB 스토리지 엔진**과 **MVCC(Multi-Version Concurrency Control)**를 활용하여 동시성을 제어합니다.

### 1. 비관적 잠금 (Pessimistic Lock)

**적용 대상:** 재고 관리, 쿠폰 발급 수량

```sql
-- InnoDB 행 레벨 락 (SELECT ... FOR UPDATE)
SELECT * FROM product_options WHERE id = ? FOR UPDATE;
```

**InnoDB 특징:**

- **행 레벨 락**: 필요한 행만 잠금하여 동시성 향상
- **Gap Lock / Next-Key Lock**: 팬텀 리드 방지
- **데드락 감지**: 자동 감지 및 롤백 처리

### 2. 낙관적 잠금 (Optimistic Lock)

**적용 대상:** 사용자 잔액 변경

```typescript
// version 필드를 통한 낙관적 잠금
await prisma.users.updateMany({
  where: { id: user.id, version: user.version },
  data: { balance: newBalance, version: user.version + 1 },
});
```

### 3. 트랜잭션 격리 수준

MySQL InnoDB 기본 격리 수준: **REPEATABLE READ**

| 격리 수준       | Dirty Read | Non-Repeatable Read | Phantom Read |
| --------------- | ---------- | ------------------- | ------------ |
| REPEATABLE READ | ❌         | ❌                  | ❌ (InnoDB)  |

> InnoDB는 REPEATABLE READ에서도 Next-Key Lock으로 팬텀 리드를 방지합니다.

### 동시성 제어 전략 선택

| 구분          | 비관적 잠금              | 낙관적 잠금                            |
| ------------- | ------------------------ | -------------------------------------- |
| **사용 시기** | 충돌 빈도 높음           | 충돌 빈도 낮음                         |
| **적용 대상** | 재고, 쿠폰 수량          | 사용자 잔액                            |
| **성능**      | 락 대기로 인한 지연 발생 | 충돌시 재시도 오버헤드                 |
| **장점**      | 데이터 일관성 강력 보장  | 높은 동시성, 데드락 없음               |
| **단점**      | 동시성 낮음, 데드락 가능 | 재시도 오버헤드 or 요청 강제 실패 처리 |

### 4. Redis 분산 락 (Distributed Lock)

**적용 대상:** 쿠폰 발급 (Scale-out 환경)

```typescript
// Redlock + Pub/Sub 기반 분산 락
const lockKey = `coupon:issue:${couponId}`;
await this.redisLockService.withLock(lockKey, async () => {
  // 쿠폰 발급 로직
});
```

**특징:**

- **Redlock 알고리즘**: 분산 환경에서 안전한 락 획득
- **Pub/Sub 기반 대기**: Spin Lock 대비 Redis 부하 80% 감소
- **자동 TTL 연장**: 장기 작업 시 락 만료 방지

> 📖 **상세 분석 문서**: [docs/REDIS_LOCK_TIMELINE.md](docs/REDIS_LOCK_TIMELINE.md)

---

## 🚀 캐시 전략

### API 응답 캐시

인기 상품 조회 API에 `@nestjs/cache-manager` 기반 캐시 적용:

```typescript
@UseInterceptors(HttpCacheInterceptor)
@CacheKey(CACHE_KEYS.PRODUCTS_TOP)
@CacheTTL(CACHE_TTL.TEN_MINUTES)
@Get('top')
async getTopProducts() { ... }
```

| 캐시 대상       | TTL    | 무효화 시점    |
| --------------- | ------ | -------------- |
| 인기 상품 Top 5 | 24시간 | 스냅샷 갱신 시 |

---

## 📊 테스트

### 테스트 구조

```
test/
├── unit/                     # 단위 테스트
│   ├── common/               # 공통 모듈 테스트
│   │   └── redis.service.spec.ts
│   └── domain/
│       ├── cart/
│       ├── coupon/
│       ├── order/
│       ├── product/
│       └── user/
├── integration/              # 통합 테스트
│   ├── database/             # DB 동시성 테스트
│   │   ├── balance-charge.integration.spec.ts
│   │   ├── coupon-issue.service.integration.spec.ts
│   │   └── ...
│   ├── redis/                # Redis 분산 락 테스트
│   │   ├── issue-coupon.use-case.integration.spec.ts
│   │   └── redis-lock.integration.spec.ts
│   └── setup.ts
└── e2e/                      # E2E 테스트
    ├── cart.e2e-spec.ts
    ├── coupon.e2e-spec.ts
    ├── order.e2e-spec.ts
    ├── product.e2e-spec.ts
    └── user.e2e-spec.ts
```

### 실행 명령어

```bash
# 전체 테스트
pnpm test

# 커버리지
pnpm test:coverage

# E2E 테스트
pnpm test:e2e

# 특정 테스트
pnpm test -- "balance-charge"
```

### 테스트 현황

| 항목        | 결과                       |
| ----------- | -------------------------- |
| 단위 테스트 | 도메인 엔티티별 검증       |
| 통합 테스트 | 동시성 제어, 트랜잭션 검증 |
| E2E 테스트  | API 엔드포인트 검증        |

---

## 🛠️ 개발 환경

### 인프라 실행

```bash
# Docker Compose로 MySQL + Redis 3개 실행
pnpm infra:up

# 인프라 중지
pnpm infra:down
```

### Redis 구성

```
┌─────────────────────────────────────────────────────────┐
│                   Redis 3개 분리 구성                    │
├─────────────────────────────────────────────────────────┤
│  :6379  │  Session Redis  │  세션 저장 (express-session)│
│  :6380  │  Lock Redis     │  분산 락 (Redlock + Pub/Sub)│
│  :6381  │  Cache Redis    │  API 응답 캐시              │
└─────────────────────────────────────────────────────────┘
```

### Scale-out 인프라 (Stage)

```bash
# 다중 서버 + Nginx LB 환경 실행
pnpm infra:up:stage
```

```
┌─────────────────────────────────────────────────────────┐
│                    Scale-out 구성                        │
├─────────────────────────────────────────────────────────┤
│  Nginx (:80)     │  Load Balancer (least_conn)          │
│  App x N         │  NestJS 서버 (Docker --scale app=N)  │
│  MySQL (:3306)   │  Primary Database                    │
│  Redis x 3       │  Session / Lock / Cache              │
└─────────────────────────────────────────────────────────┘
```

### K6 부하 테스트

```bash
# 쿠폰 발급 동시성 테스트 (100 VUs, 10초)
k6 run k6/issue-coupon.script.js

# 잔액 충전 동시성 테스트
k6 run k6/balance-charge.script.js
```

> 📖 **K6 테스트 가이드**: [k6/README.md](k6/README.md)

### Prisma 명령어

```bash
# 스키마 동기화
pnpm prisma:update

# 스키마 차이 확인
pnpm prisma:diff-check
```

---

## 📚 문서

### 아키텍처 & 설계

- [아키텍처 설계](docs/ARCHITECTURE.md)
- [쿼리 최적화 보고서](docs/QUERY_OPTIMIZATION_REPORT.md)

### Redis & 동시성

- [Redis 분산 락 타임라인](docs/REDIS_LOCK_TIMELINE.md)
- [Redis 분산 락 성능 분석](docs/REDIS_LOCK_PERFORMANCE.md)
- [Redis 분산 락 로그 분석](docs/REDIS_LOCK_LOG_ANALYSIS.md)

### 캐시 & 성능

- [캐시 성능 개선 보고서](docs/CACHE_PERFORMANCE_REPORT.md)
- [K6 부하 테스트 가이드](k6/README.md)

### API 문서

- [API 요구사항](docs/api/requirements.md)
- [API 명세서](docs/api/api-specification.md)
- [데이터 모델](docs/api/data-models.md)
- [사용자 스토리](docs/api/user-stories.md)
