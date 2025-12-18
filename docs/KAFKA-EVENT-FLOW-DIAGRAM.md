# 📋 Kafka 이벤트 흐름 다이어그램 문서 (Choreography Saga)

> 이 문서는 Kafka 기반 Choreography Saga 패턴의 상세 이벤트 흐름을 설명합니다.
> 아키텍처 설계에 대한 내용은 [KAFKA-EVENT-DRIVEN-ARCHITECTURE.md](./KAFKA-EVENT-DRIVEN-ARCHITECTURE.md) 문서를 참고하세요.

---

## 📑 목차

1. [전체 이벤트 흐름도](#1-전체-이벤트-흐름도)
2. [상세 시퀀스 다이어그램 (Happy Path)](#2-상세-시퀀스-다이어그램-happy-path)
3. [보상 트랜잭션 흐름 (Failure Path)](#3-보상-트랜잭션-흐름-failure-path)

---

## 1. 전체 이벤트 흐름도

```mermaid
graph TD
    Start((주문 요청)) --> OP[Topic: order.processing]
    
    OP --> Product[Product Service]
    OP --> Coupon[Coupon Service]
    OP --> Init[Order Aggregator Init]
    
    Product -- 성공 --> OPS[Topic: stock.success]
    Coupon -- 성공 --> OPC[Topic: coupon.success]
    
    OPS --> Agg[Order Aggregator]
    OPC --> Agg
    
    Agg -- 모두 완료 --> Success[Topic: processing.success]
    
    Success --> PayReq[Topic: order.payment]
    
    PayReq --> User[User Service]
    
    User -- 성공 --> PaySuccess[Topic: payment.success]
    User -- 실패 --> PayFail[Topic: payment.fail]
    
    PaySuccess --> Final[Topic: order.processed]
    
    Final --> Ext[External Platform]
    
    %% 실패 흐름
    Product -- 실패 --> Fail[Topic: processing.fail]
    Coupon -- 실패 --> Fail
    
    Fail --> Rollback[Rollback Process]
    PayFail --> Rollback
```

---

## 2. 상세 시퀀스 다이어그램 (Happy Path)

### 2.1 초기화 및 병렬 처리 (Processing Phase)

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant OrderAPI
    participant Kafka
    participant ProductSvc
    participant CouponSvc
    participant OrderAgg as OrderAggregator(Redis)

    Client->>OrderAPI: 결제 요청
    OrderAPI->>Kafka: send(order.processing)
    OrderAPI-->>Client: 202 Accepted (비동기 처리)

    par Parallel Processing
        Kafka->>ProductSvc: consume(order.processing)
        ProductSvc->>ProductSvc: 재고 차감
        ProductSvc->>Kafka: send(stock.success)
    and
        Kafka->>CouponSvc: consume(order.processing)
        CouponSvc->>CouponSvc: 쿠폰 사용
        CouponSvc->>Kafka: send(coupon.success)
    and
        Kafka->>OrderAgg: consume(order.processing)
        OrderAgg->>OrderAgg: 상태 초기화
    end

    Kafka->>OrderAgg: consume(stock.success)
    OrderAgg->>OrderAgg: Mark Stock OK
    
    Kafka->>OrderAgg: consume(coupon.success)
    OrderAgg->>OrderAgg: Mark Coupon OK
    
    Note over OrderAgg: All Ready? YES
    OrderAgg->>Kafka: send(processing.success)
```

### 2.2 결제 및 완료 (Payment Phase)

```mermaid
sequenceDiagram
    autonumber
    participant Kafka
    participant OrderSvc
    participant UserSvc
    participant ExtSvc

    Kafka->>OrderSvc: consume(processing.success)
    OrderSvc->>OrderSvc: 쿠폰 할인 적용 (DB)
    OrderSvc->>Kafka: send(order.payment)

    Kafka->>UserSvc: consume(order.payment)
    UserSvc->>UserSvc: 잔액 차감
    UserSvc->>Kafka: send(payment.success)

    Kafka->>OrderSvc: consume(payment.success)
    OrderSvc->>OrderSvc: 주문 상태 변경 (PAID)
    OrderSvc->>Kafka: send(order.processed)

    Kafka->>ExtSvc: consume(order.processed)
    ExtSvc->>ExtSvc: 외부 데이터 전송
```

---

## 3. 보상 트랜잭션 흐름 (Failure Path)

### 3.1 잔액 부족 시 (Payment Fail)

```mermaid
sequenceDiagram
    autonumber
    participant Kafka
    participant UserSvc
    participant OrderSvc
    participant ProductSvc
    participant CouponSvc

    Kafka->>UserSvc: consume(order.payment)
    UserSvc->>UserSvc: 잔액 차감 시도 -> 실패!
    UserSvc->>Kafka: send(payment.fail)

    par Rollback All
        Kafka->>OrderSvc: consume(payment.fail)
        OrderSvc->>OrderSvc: 주문 취소 (CANCELLED)
    and
        Kafka->>ProductSvc: consume(payment.fail)
        ProductSvc->>ProductSvc: 재고 복구
    and
        Kafka->>CouponSvc: consume(payment.fail)
        CouponSvc->>CouponSvc: 쿠폰 복구
    end
```
