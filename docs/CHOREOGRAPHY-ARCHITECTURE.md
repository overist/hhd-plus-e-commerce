# 🕺 코레오그래피 기반 결제 이벤트 아키텍처 설계 보고서

> 이 문서는 **ProcessPayment(결제 처리)** 유즈케이스를 **오케스트레이션 제거 → 코레오그래피(Choreography) 기반 이벤트 체인**으로 전환한 설계를 설명합니다.
> 상세 이벤트 플로우/다이어그램은 [CHOREOGRAPHY-FLOW-DIAGRAM.md](./CHOREOGRAPHY-FLOW-DIAGRAM.md)를 참고하세요.

---

## 📑 목차

1. [전환 배경](#1-전환-배경)
2. [코레오그래피 설계 적용](#2-코레오그래피-설계-적용)
3. [트랜잭션/보상(사가) 전략](#3-트랜잭션보상사가-전략)
4. [이벤트 매트릭스](#4-이벤트-매트릭스)
5. [배포 단위 도메인 분리](#5-배포-단위-도메인-분리)
6. [결론](#6-결론)

---

## 1. 전환 배경

### 1.1 오케스트레이션(AS-IS)의 전형적 문제

오케스트레이션 패턴은 중앙 오케스트레이터가 **여러 도메인 서비스 호출 순서/실패 처리**를 직접 책임지게 되면서 다음 문제가 자주 발생합니다.

- 결제 유즈케이스가 Product/Coupon/User 등 다수 도메인에 직접 의존
- 실패/보상 로직이 한 곳(유즈케이스)으로 집중되어 복잡도 증가
- 새 리스너(알림/정산/분석 등) 추가 시 오케스트레이터 수정 가능성 증가

### 1.2 목표(TO-BE)

- 결제 흐름의 “진행”을 **이벤트의 연쇄(성공 이벤트 체인)** 로 표현
- 각 도메인이 **자신의 트랜잭션/실패/보상**을 자율적으로 관리
- API 요청은 “결제 시작”을 빠르게 반환하고, 실제 처리는 이벤트로 진행

---

## 2. 코레오그래피 설계 적용

### 2.1 핵심 아이디어

이 설계에서 결제 흐름은 아래처럼 동작합니다.

- `ProcessPaymentUseCase`는 **분산락 + 주문 상태 전이(PAYMENT_PROCESSING)** 까지만 책임지고,
- 이후 단계 진행은 각 도메인이 발행하는 **success/fail 이벤트**가 이어받습니다.

즉, “다음 단계로 넘어가라”는 제어가 특정 오케스트레이터의 `await`가 아니라,
**성공 이벤트를 수신한 다른 리스너의 발행**으로 이어집니다.

### 2.2 TO-BE 아키텍처(요약)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                 CHOREOGRAPHY PAYMENT FLOW (IN-PROCESS EVENTS)                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Client                                                                      │
│    │                                                                         │
│    │ 1) POST /orders/:id/payment                                             │
│    ▼                                                                         │
│  ProcessPaymentUseCase (Order)                                               │
│   - Redis Lock(payment:order:{orderId})                                      │
│   - 상태: PENDING → PAYMENT_PROCESSING                                      │
│   - order.processing 발행 (non-blocking)                                     │
│                                                                              │
│    order.processing                                                          │
│      ├──────────────► Product: 재고 확정 차감                                │
│      │                 └─ order.processing.stock.success                     │
│      └──────────────► Coupon: 쿠폰 사용(Redis+DB)                            │
│                        └─ order.processing.coupon.success                    │
│                                                                              │
│    (Join) Order: order.processing (상태 집계 리스너)                          │
│      └─ (재고 OK && 쿠폰 OK) → order.processing.success                       │
│                                                                              │
│    order.processing.success                                                  │
│      └──────────────► Order: 쿠폰 적용/최종금액 확정 → order.payment 발행      │
│                                                                              │
│    order.payment                                                             │
│      └──────────────► User: 잔액 차감 → order.payment.success/fail            │
│                                                                              │
│    order.payment.success                                                     │
│      └──────────────► Order: 상태 PAID 확정 → order.processed 발행            │
│                                                                              │
│    order.processed (side effects)                                            │
│      ├──────────────► Order: Kafka 발행(order.processed topic)               │
│      └──────────────► Product: 판매 랭킹 기록(Redis)                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 “중앙 오케스트레이터”가 없는 이유

- `ProcessPaymentUseCase`는 **하위 도메인 서비스(Product/Coupon/User)** 를 직접 호출하지 않습니다.
- 흐름의 제어는 `order.processing.*.success` → `order.processing.success` → `order.payment` → `order.payment.success` 처럼
  **이벤트 체인**이 수행합니다.

> 참고: `order.processing` 단계에서 재고/쿠폰의 성공을 합류(join)하기 위해 Order 모듈 내부에 “상태 집계 리스너”가 존재합니다.
> 이는 “서비스 호출 순서 제어” 오케스트레이션이 아니라, **분산된 성공 신호를 합쳐 다음 이벤트를 발행하는 코레오그래피의 일부(집계/게이트)** 로 사용됩니다.

---

## 3. 트랜잭션/보상(사가) 전략

### 3.1 트랜잭션 경계

- **주문 상태 전이**: Order 도메인 트랜잭션
- **재고 확정 차감**: Product 도메인 트랜잭션(DB 비관적 잠금 사용)
- **쿠폰 사용**: Coupon 도메인 트랜잭션(Redis Lua + DB 동기화)
- **잔액 차감**: User 도메인 트랜잭션(DB 낙관적 잠금 + 재시도)

### 3.2 실패 이벤트와 보상 트랜잭션

- `order.processing.fail`
  - 발생 지점: Product/Coupon/Order(쿠폰 반영 단계)에서 예외 발생
  - 보상: Product/Coupon/Order가 각각 자신의 롤백을 수행
- `order.payment.fail`
  - 발생 지점: User 잔액 차감 실패 또는 Order(결제 완료 확정 단계) 실패
  - 보상: Product/Coupon/Order가 각각 자신의 롤백을 수행

보상 완료 추적을 위해 각 도메인의 보상 리스너는

- `order.processing.fail.done`
- `order.payment.fail.done`
  를 추가로 발행합니다(현재는 관측/추적 목적).

### 3.3 동시성 제어

- Redis 분산락: `payment:order:{orderId}` (중복 결제 방지, TTL 10초)
- Product 재고: DB 비관적 잠금(FOR UPDATE)
- User 잔액: DB 낙관적 잠금 + 재시도
- Coupon: Redis Lua 스크립트(원자적 사용/취소)

---

## 4. 이벤트 매트릭스

| 이벤트                            | 발행자                  | 구독자(리스너)             | 처리 내용                               | 성격               |
| --------------------------------- | ----------------------- | -------------------------- | --------------------------------------- | ------------------ |
| `order.processing`                | `ProcessPaymentUseCase` | Product/Coupon/Order(집계) | 재고/쿠폰 처리 시작 및 상태 집계 초기화 | 비동기(in-process) |
| `order.processing.stock.success`  | Product                 | Order(집계)                | 재고 확정 차감 성공 신호                | 비동기(in-process) |
| `order.processing.coupon.success` | Coupon                  | Order(집계)                | 쿠폰 사용 성공 + 할인 정보 전달         | 비동기(in-process) |
| `order.processing.success`        | Order(집계)             | Order(다음 단계)           | (재고 OK && 쿠폰 OK) → 결제 단계 진행   | 비동기(in-process) |
| `order.payment`                   | Order                   | User                       | 잔액 차감 시작                          | 비동기(in-process) |
| `order.payment.success`           | User                    | Order                      | 주문 PAID 확정 및 후속 처리 트리거      | 비동기(in-process) |
| `order.processed`                 | Order                   | Order/Product              | Kafka 발행, 판매 랭킹 집계(부가 로직)   | 비동기(in-process) |
| `order.processing.fail`           | Product/Coupon/Order    | Order/Product/Coupon       | 보상 트랜잭션 트리거                    | 비동기(in-process) |
| `order.payment.fail`              | User/Order              | Order/Product/Coupon       | 보상 트랜잭션 트리거                    | 비동기(in-process) |
| `order.processing.fail.done`      | Order/Product/Coupon    | (없음/관측용)              | processing 보상 완료 신호               | 비동기(in-process) |
| `order.payment.fail.done`         | Order/Product/Coupon    | (없음/관측용)              | payment 보상 완료 신호                  | 비동기(in-process) |

> 주의: 현재 구현은 Nest `EventEmitter2.emit()` 기반 **프로세스 내부 이벤트**이며, `emit`은 async 리스너를 `await`하지 않습니다.
> 장애/재시작에 대한 “처리 보장”이 필요하다면 Outbox + Broker(예: Kafka) 기반으로 확장하는 것이 안전합니다.

---

## 5. 배포 단위 도메인 분리

- `src/order/`: 결제 시작(UseCase), 주문 상태 전이, 성공/실패 이벤트로 흐름 연결, 데이터 플랫폼 송신(Kafka)
- `src/product/`: 재고 확정 차감/롤백, 판매 랭킹 집계
- `src/coupon/`: 쿠폰 사용/취소(Redis), 정산용 DB 동기화
- `src/user/`: 잔액 차감 및 이력 기록

---

## 6. 결론

- 결제 처리의 “흐름 제어”를 중앙 오케스트레이터 호출에서 **성공 이벤트 체인**으로 이동시켜 결합도를 낮췄습니다.
- 각 도메인은 자신의 트랜잭션/보상 책임을 갖고, 실패는 `*.fail` 이벤트로 전파되어 사가 형태로 복구됩니다.
- 부가 작업(데이터 플랫폼, 판매 랭킹)은 `order.processed`에서 분리되어 결제 핵심 성공/실패와 분리됩니다.

> 📅 문서 작성일: 2025년 12월 19일
