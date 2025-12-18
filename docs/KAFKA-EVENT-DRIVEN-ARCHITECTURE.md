# 📊 Kafka 기반 이벤트 아키텍처 설계 보고서 (Choreography Saga)

> 이 문서는 Kafka를 활용하여 **Choreography Saga Pattern**으로 구현된 결제 시스템의 아키텍처를 다룹니다.
> 상세 이벤트 흐름도는 [KAFKA-EVENT-FLOW-DIAGRAM.md](./KAFKA-EVENT-FLOW-DIAGRAM.md) 문서를 참고하세요.

---

## 📑 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [설계 패턴: Choreography Saga & Aggregator](#2-설계-패턴-choreography-saga--aggregator)
3. [이벤트 및 토픽 정의](#3-이벤트-및-토픽-정의)
4. [보상 트랜잭션 전략](#4-보상-트랜잭션-전략)
5. [한계점 및 개선 필요사항](#5-한계점-및-개선-필요사항)

---

## 1. 아키텍처 개요

### 1.1 도입 배경

기존의 중앙 집중형 오케스트레이션(Orchestration) 방식에서 벗어나, 각 도메인 서비스가 이벤트를 주고받으며 자율적으로 트랜잭션을 처리하는 **완전한 이벤트 기반 아키텍처(EDA)**로 전환하였습니다. 이를 통해 서비스 간 결합도를 낮추고, 시스템의 확장성과 유연성을 극대화했습니다.

### 1.2 전체 구조도

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Kafka Choreography Saga Architecture                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   [Order Service]        [Product Service]      [Coupon Service]             │
│          │                      │                      │                     │
│          ▼                      ▼                      ▼                     │
│  ┌───────────────┐      ┌───────────────┐      ┌───────────────┐             │
│  │ Order Producer│      │ProductConsumer│      │CouponConsumer │             │
│  └───────┬───────┘      └───────┬───────┘      └───────┬───────┘             │
│          │ 1. order.processing  │                      │                     │
│          └──────────────────────┼──────────────────────┘                     │
│                                 │                                            │
│          ┌──────────────────────┴──────────────────────┐                     │
│          │                                             │                     │
│  ┌───────▼───────┐      ┌───────▼───────┐      ┌───────▼───────┐             │
│  │ OrderAggregator      │ProductProducer│      │CouponProducer │             │
│  │ (State Store) │      └───────┬───────┘      └───────┬───────┘             │
│  └───────┬───────┘              │ 2. stock.success     │ 2. coupon.success   │
│          │ 3. processing.success│                      │                     │
│          ▼                      └──────────────────────┘                     │
│  ┌───────────────┐                                                           │
│  │ Order Consumer│                                                           │
│  └───────┬───────┘                                                           │
│          │ 4. order.payment                                                  │
│          ▼                                                                   │
│  ┌───────────────┐      ┌───────────────┐                                    │
│  │ User Consumer │      │ User Producer │                                    │
│  └───────┬───────┘      └───────┬───────┘                                    │
│          │                      │ 5. payment.success                         │
│          └──────────────────────┘                                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 설계 패턴: Choreography Saga & Aggregator

### 2.1 Choreography Saga Pattern

중앙의 오케스트레이터가 모든 흐름을 제어하는 대신, 각 서비스가 이벤트를 구독하고 처리한 후 다음 이벤트를 발행하는 방식입니다.

- **장점**: 서비스 간 의존성 제거, 단일 실패 지점(SPOF) 최소화.
- **단점**: 트랜잭션 상태 파악이 어려움 -> **Aggregator**로 해결.

### 2.2 Aggregator Pattern (State Store)

병렬로 처리되는 재고 차감과 쿠폰 사용의 결과를 취합하기 위해 `OrderProcessingStateStore`(Redis 기반)를 도입했습니다.

1. `order.processing` 이벤트 발생 시 상태 초기화.
2. `stock.success`, `coupon.success` 이벤트 수신 시 각각 상태 업데이트.
3. 모든 조건이 충족(`stockOk && couponOk`)되면 `order.processing.success` 이벤트를 발행하여 다음 단계로 진행.

---

## 3. 이벤트 및 토픽 정의

### 3.1 주요 토픽 흐름

| 단계          | 토픽명                            | 발행 주체 | 구독 주체                    | 설명                                    |
| ------------- | --------------------------------- | --------- | ---------------------------- | --------------------------------------- |
| **1. 시작**   | `order.processing`                | Order     | Product, Coupon, Order(Init) | 결제 프로세스 시작, 재고/쿠폰 처리 요청 |
| **2. 처리**   | `order.processing.stock.success`  | Product   | Order(Aggregator)            | 재고 차감 성공                          |
|               | `order.processing.coupon.success` | Coupon    | Order(Aggregator)            | 쿠폰 사용 성공                          |
| **3. 집계**   | `order.processing.success`        | Order     | Order                        | 재고/쿠폰 모두 성공, 결제 준비 완료     |
| **4. 결제**   | `order.payment`                   | Order     | User                         | 사용자 잔액 차감 요청                   |
| **5. 완료**   | `order.payment.success`           | User      | Order                        | 잔액 차감 성공, 최종 주문 완료 처리     |
| **6. 후처리** | `order.processed`                 | Order     | External Platform            | 외부 데이터 전송, 통계 집계             |

### 3.2 실패/보상 토픽

| 토픽명                  | 발행 주체       | 구독 주체              | 설명                                         |
| ----------------------- | --------------- | ---------------------- | -------------------------------------------- |
| `order.processing.fail` | Product, Coupon | Order, Product, Coupon | 재고/쿠폰 처리 중 실패. 보상 트랜잭션 트리거 |
| `order.payment.fail`    | User            | Order, Product, Coupon | 잔액 차감 실패. 전체 롤백 트리거             |

---

## 4. 보상 트랜잭션 전략

각 단계에서 실패가 발생하면 `*.fail` 이벤트를 발행하여 이전에 성공했던 트랜잭션들을 롤백합니다.

- **재고/쿠폰 단계 실패**: `order.processing.fail` 발행 -> 주문 취소.
- **잔액 차감 단계 실패**: `order.payment.fail` 발행 -> 재고 복구, 쿠폰 복구, 주문 취소.

---

## 5. 한계점 및 개선 필요사항

### 5.1 Outbox Pattern 미적용

- **문제**: DB 트랜잭션과 Kafka 발행이 원자적이지 않아, DB는 커밋되었으나 메시지 발행 실패 시 데이터 불일치 발생 가능.
- **개선**: Outbox 테이블 도입 및 CDC(Change Data Capture) 또는 Polling Publisher 구현 필요.

### 5.2 DLQ (Dead Letter Queue) 부재

- **문제**: 컨슈머 처리 실패 시 재시도 메커니즘이 부족하여 메시지 유실 가능성 있음.
- **개선**: Retry Topic 및 DLQ 도입으로 안정성 확보 필요.

### 5.3 모니터링 복잡성

- **문제**: 분산된 이벤트 흐름으로 인해 트랜잭션 추적이 어려움.
- **개선**: Distributed Tracing 도입 필요.
