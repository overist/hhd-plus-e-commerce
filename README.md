# 🛒 HHPlus E-Commerce

NestJS 기반 이커머스 백엔드 시스템

## 기술 스택

- **Framework**: NestJS
- **Database**: MySQL 8.0 (InnoDB, MVCC)
- **ORM**: Prisma
- **EDA**: EventEmitter2 (`@nestjs/event-emitter`)
- **Redis**
  - **NoSQL/Session**: 범용 Redis 클라이언트 (`src/@common/redis/*`, `main.ts` 세션 스토어)
  - **Cache**: `@nestjs/cache-manager` + Keyv (namespace: `cache`)
  - **Distributed Lock**: ioredis + Pub/Sub + watchdog (`src/@common/redis-lock-manager/*`)
- **Testing**: Jest, Testcontainers

---

## 폴더 구조

```
src/
├── @auth/                    # 인증 모듈 (추후 서버리스로 분리 가능)
├── @schedulers/              # 배치 스케줄러 (추후 분리 가능)
├── @common/                  # 공통 모듈
│   ├── cache-manager/        # API 응답 캐시 (cache-manager + Keyv)
│   ├── exception/            # 레이어별 예외 필터
│   ├── guards/               # 인증 가드
│   ├── mutex-manager/        # async-mutex
│   ├── prisma-manager/       # Prisma 트랜잭션 유틸
│   ├── redis/                # 범용 Redis (NoSQL/세션 등)
│   └── redis-lock-manager/   # 분산 락 (ioredis + Pub/Sub + watchdog)
│
├── @schedulers/              # 스케줄러 모듈
│
├── cart/                     # 장바구니 도메인 모듈
│   ├── cart.module.ts
│   ├── application/          # UseCase + Application DTO
│   ├── domain/               # Entity + DomainService + Repository Port
│   ├── infrastructure/       # Repository Adapter (Prisma/Memory 등)
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

## 설계 원칙

### 계층별 역할

| 계층               | 역할                           | 주요 구성 요소                              |
| ------------------ | ------------------------------ | ------------------------------------------- |
| **Presentation**   | HTTP 요청/응답, 유효성 검증    | Controller, Request/Response DTO            |
| **Application**    | 유즈케이스 실행, 트랜잭션 경계 | UseCase, Command/Query/Result DTO           |
| **Domain**         | 핵심 비즈니스 규칙             | Entity, DomainService, Repository Interface |
| **Infrastructure** | 외부 시스템 연동               | Repository 구현체 (Prisma)                  |

### DIP (Dependency Inversion)

레이어드 아키텍처를 유지하면서도 **DIP(Port/Adapter)** 를 적용했습니다.

- Domain이 Repository **Port** 를 정의: `src/*/domain/interfaces/*.repository.interface.ts`
- Infrastructure가 **Adapter** 를 구현: `src/*/infrastructure/*.repository.ts`
- Nest Module에서 추상화에 바인딩: `{ provide: IOrderRepository, useClass: OrderRepository }`

### DTO 패턴

```
Presentation DTO          Application DTO
─────────────────         ─────────────────
AddCartRequest     →      AddCartCommand      (toCommand)
AddCartResponse    ←      AddCartResult       (fromDomain)
```

- **CQRS 패턴**: Command(변경) vs Query(조회) 분리 (추후 인프라레벨 CQRS 도입시 활용)
- **1 UseCase = 1 DTO 세트**: 단일 책임 원칙 적용

---

## 이벤트 기반 결제 (Orchestration Saga)

결제는 **오케스트레이션 패턴의 Saga**로 구성되어 있습니다.
`ProcessPaymentUseCase`가 단계 전환과 결과 검증(동기 `emitAsync`)을 담당하고, 실패 시 `*.fail` 이벤트로 **보상 트랜잭션**을 트리거합니다.

```
1) order.processing (emitAsync)  - 재고 확정/쿠폰 사용
2) order.payment    (emitAsync)  - 잔액 차감
3) order.processed  (emit)       - 외부 전송/랭킹 집계 (부가 로직)

실패 시
  - order.processing.fail / order.payment.fail
  - 각 도메인이 "자기 트랜잭션"으로 자율 롤백(Compensation)
```

관련 문서: [EVENT-DRIVEN-ARCHITECTURE](docs/EVENT-DRIVEN-ARCHITECTURE.md), [EVENT-FLOW-DIAGRAM](docs/EVENT-FLOW-DIAGRAM.md)

---

## 동시성 제어

### 1) 비관적 잠금 (Pessimistic Lock)

재고 등 충돌 가능성이 큰 리소스는 `SELECT ... FOR UPDATE` 기반으로 처리합니다.

### 2) 낙관적 잠금 (Optimistic Lock)

충돌 가능성이 낮은 사용자 잔액은 버전 기반으로 충돌을 감지하고 재시도/실패 처리합니다.

### 3) Redis 분산 락 (Distributed Lock)

**적용 대상:** 쿠폰 발급 (Scale-out 환경), 주문 결제

```typescript
// Pub/Sub 기반 분산 락
const lockKey = `lock:coupon:issue:${couponId}`;
await this.redisLockService.withLock(lockKey, async () => {
  // 쿠폰 발급 로직
});
```

**특징:**

- **Pub/Sub 기반 대기**: Spin Lock 대비 Redis 부하 80% 감소
- **Watchdog TTL 연장**: 장기 작업 시 락 만료 방지

> 📖 **상세 분석 문서**: [docs/REDIS_LOCK_TIMELINE.md](docs/REDIS_LOCK_TIMELINE.md)

---

## 캐시 전략

`@nestjs/cache-manager` + Keyv 기반의 HTTP 응답 캐시를 사용합니다.

---

## 테스트

### 테스트 구조

```
test/
├── unit/                     # 단위 테스트
│   ├── common/               # 공통 모듈 테스트
│   └── domain/               # 도메인 엔티티, 서비스 테스트
├── integration/              # 통합 테스트
│   ├── database/             # 동시성 발생 유즈케이스 테스트
│   ├── redis/                # Redis DB 연동 테스트, 동시성 테스트
│   └── setup.ts
└── e2e/
    ├── auth.e2e-spec.ts
    └── health.e2e-spec.ts
```

### 실행 명령어

```bash
pnpm test
pnpm test:coverage
pnpm test:e2e
```

---

## 개발 환경 실행

### 1. 인프라 실행

```bash
# 로컬 개발용 docker compose 기반 인프라 실행
pnpm infra:up

# 분산 서버 환경 인프라 실행
pnpm infra:up:stage

# 인프라 종료
pnpm infra:down
```

### 2. Prisma Client 생성 및 Diff 체크

```bash
pnpm prisma:update
pnpm prisma:diff-check
```

### 3. 애플리케이션 실행

```bash
pnpm start:dev
```

---

## 문서

- 아키텍처: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- EDA:
  - [docs/EVENT-DRIVEN-ARCHITECTURE.md](docs/EVENT-DRIVEN-ARCHITECTURE.md)
  - [docs/EVENT-FLOW-DIAGRAM.md](docs/EVENT-FLOW-DIAGRAM.md)
- Redis Lock 분석:
  - [docs/REDIS_LOCK_TIMELINE.md](docs/REDIS_LOCK_TIMELINE.md)
  - [docs/REDIS_LOCK_PERFORMANCE.md](docs/REDIS_LOCK_PERFORMANCE.md)
  - [docs/REDIS_LOCK_LOG_ANALYSIS.md](docs/REDIS_LOCK_LOG_ANALYSIS.md)
- 캐시 성능: [docs/CACHE_PERFORMANCE_REPORT.md](docs/CACHE_PERFORMANCE_REPORT.md)
- Spec 및 요구사항
  - API 요구사항: [docs/api/requirements.md](docs/api/requirements.md)
  - API 명세서: [docs/api/api-specification.md](docs/api/api-specification.md)
  - 데이터 모델: [docs/api/data-models.md](docs/api/data-models.md)
  - 사용자 스토리: [docs/api/user-stories.md](docs/api/user-stories.md)
