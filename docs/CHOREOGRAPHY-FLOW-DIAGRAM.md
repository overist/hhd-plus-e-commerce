# 📋 ProcessPayment(결제 처리) 코레오그래피 이벤트 흐름 다이어그램

> 이 문서는 **코레오그래피(Choreography)** 기반으로 구현된 결제 처리 유즈케이스의 이벤트 흐름과 보상 트랜잭션(사가) 흐름을 설명합니다.
> 설계 원칙/아키텍처 요약은 [CHOREOGRAPHY-ARCHITECTURE.md](./CHOREOGRAPHY-ARCHITECTURE.md)를 참고하세요.

---

## 📑 목차

1. [이벤트 흐름 다이어그램](#1-이벤트-흐름-다이어그램)
2. [결제 처리 단계별 상세](#2-결제-처리-단계별-상세)
3. [보상 트랜잭션(사가) 흐름](#3-보상-트랜잭션사가-흐름)

---

## 1. 이벤트 흐름 다이어그램

### 1.1 전체 구조(코레오그래피)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      CHOREOGRAPHY EVENT-DRIVEN ARCHITECTURE                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  (HTTP)                                                                       │
│  Client ──► OrderController ──► ProcessPaymentUseCase                          │
│                                   - RedisLock(payment:order:{orderId})        │
│                                   - 상태: PENDING → PAYMENT_PROCESSING        │
│                                   - order.processing 발행                      │
│                                                                              │
│                        ┌──────────────────────────────────────────────┐       │
│                        │             order.processing                 │       │
│                        └───────────────┬──────────────────────────────┘       │
│                                        │                                      │
│                 ┌──────────────────────┼──────────────────────┐              │
│                 │                      │                      │              │
│                 ▼                      ▼                      ▼              │
│       Product: 재고 확정 차감     Coupon: 쿠폰 사용        Order: 상태 집계     │
│       └─ stock.success            └─ coupon.success         (join gate)        │
│          (실패→processing.fail)      (실패→processing.fail)                    │
│                 │                      │                                      │
│                 └──────────┬───────────┘                                      │
│                            ▼                                                  │
│                   order.processing.success                                     │
│                            ▼                                                  │
│                Order: 쿠폰 반영/최종금액 확정                                  │
│                            ▼                                                  │
│                        order.payment                                          │
│                            ▼                                                  │
│                 User: 잔액 차감(success/fail)                                  │
│                      ├─ order.payment.success                                 │
│                      └─ order.payment.fail                                    │
│                            ▼                                                  │
│             Order: 주문 PAID 확정 → order.processed 발행                        │
│                            ▼                                                  │
│                 order.processed (side effects)                                 │
│                      ├─ Order: Kafka topic 발행(order.processed)              │
│                      └─ Product: 판매 랭킹 기록(Redis)                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 결제 처리 단계별 상세

### STEP 0: 결제 시작(UseCase)

- Redis 분산락 획득: `payment:order:{orderId}`
- 주문 조회 및 소유권 검증
- 주문 상태 변경: `PENDING → PAYMENT_PROCESSING`
- `order.processing` 이벤트 발행 (non-blocking)

> 현재 구현은 `EventEmitter2.emit()` 기반이며, UseCase는 이후 단계 완료를 `await`하지 않습니다.

### STEP 1: 주문 처리(order.processing)

- Product 모듈: 재고 확정 차감
  - 성공: `order.processing.stock.success`
  - 실패: `order.processing.fail`

- Coupon 모듈: 쿠폰 사용 처리(쿠폰이 있는 경우)
  - 성공: `order.processing.coupon.success`
  - 실패: (자체 Redis 롤백 후) `order.processing.fail`

- Order 모듈(상태 집계): 재고/쿠폰 성공 신호를 합쳐 다음 단계로 진행
  - 조건: `stockOk == true` AND `couponOk == true` (쿠폰 미적용 주문은 `couponOk=true`로 시작)
  - 조건 충족 시: `order.processing.success`

### STEP 2: 결제 진행(order.processing.success → order.payment)

- Order 모듈: 쿠폰 할인 정보를 주문에 반영하여 최종 금액을 확정
- `order.payment` 이벤트 발행

### STEP 3: 잔액 차감(order.payment)

- User 모듈: 사용자 잔액 차감
  - 성공: `order.payment.success`
  - 실패: `order.payment.fail`

### STEP 4: 결제 완료 확정(order.payment.success → order.processed)

- Order 모듈: 주문 상태를 `PAID`로 확정
- `order.processed` 이벤트 발행

### STEP 5: 부가 작업(order.processed)

- Order 모듈: Kafka 토픽 `order.processed`로 주문 데이터 발행
- Product 모듈: 판매 랭킹 업데이트(Redis)

> 부가 작업 실패는 결제 성공/실패에 영향을 주지 않습니다.

---

## 3. 보상 트랜잭션(사가) 흐름

### CASE 1: order.processing 단계 실패

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          order.processing.fail (Saga)                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  원인: 재고 확정 차감 실패 OR 쿠폰 사용 실패 OR 주문 쿠폰 반영 실패           │
│                                                                              │
│  order.processing.fail                                                        │
│     ├────────► Product: 재고 롤백(부분 롤백 포함)                             │
│     │           └─ order.processing.fail.done(handler=product)               │
│     ├────────► Coupon: 쿠폰 롤백(Redis + DB sync 삭제)                        │
│     │           └─ order.processing.fail.done(handler=coupon)                │
│     └────────► Order: 주문 상태 롤백(PAYMENT_PROCESSING → PENDING)            │
│                 └─ order.processing.fail.done(handler=order)                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

- 쿠폰 리스너 자체가 실패한 경우에는 이미 Redis 롤백을 수행했을 수 있으므로, 쿠폰 보상 리스너는 이를 감안하여 롤백을 스킵합니다.

### CASE 2: order.payment 단계 실패

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            order.payment.fail (Saga)                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  원인: 잔액 부족/차감 실패 OR 주문 PAID 확정 실패                              │
│                                                                              │
│  order.payment.fail                                                           │
│     ├────────► Product: 재고 롤백(확정 차감 복구)                              │
│     │           └─ order.payment.fail.done(handler=product)                  │
│     ├────────► Coupon: 쿠폰 롤백(사용 취소 + DB sync 삭제)                     │
│     │           └─ order.payment.fail.done(handler=coupon)                   │
│     └────────► Order: 주문 상태 롤백(PAYMENT_PROCESSING/PAID → PENDING)        │
│                 └─ order.payment.fail.done(handler=order)                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

> 📅 문서 작성일: 2025년 12월 19일
