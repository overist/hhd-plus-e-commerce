## 폴더 구조

```
src/
├── presentation/          # API 계층
│   ├── cart/             # 장바구니 컨트롤러, DTO
│   ├── coupon/           # 쿠폰 컨트롤러, DTO
│   ├── order/            # 주문 컨트롤러, DTO
│   ├── product/          # 상품 컨트롤러, DTO
│   ├── user/             # 사용자 컨트롤러, DTO
│   └── common/           # 공통 필터 (Domain/Validation Exception 필터)
│
├── application/           # 유스케이스 계층
│   └── facades/          # "트랜잭션 경계", 비즈니스 플로우 조합
│       ├── cart.facade.ts
│       ├── coupon.facade.ts
│       ├── order.facade.ts
│       ├── product.facade.ts
│       └── user.facade.ts
│
├── domain/                # 도메인 계층
│   ├── cart/             # 장바구니 엔티티, 도메인 서비스
│   │   ├── cart-item.entity.ts
│   │   └── cart.service.ts
│   ├── coupon/           # 쿠폰, 사용자쿠폰 엔티티, 도메인 서비스
│   │   ├── coupon.entity.ts
│   │   ├── user-coupon.entity.ts
│   │   └── coupon.service.ts
│   ├── order/            # 주문, 주문상품 엔티티, 도메인 서비스
│   │   ├── order.entity.ts
│   │   ├── order-item.entity.ts
│   │   ├── order-status.vo.ts
│   │   ├── transaction-out-failure-log.entity.ts
│   │   └── order.service.ts
│   ├── product/          # 상품, 상품옵션, 인기상품스냅샷 엔티티, 도메인 서비스
│   │   ├── product.entity.ts
│   │   ├── product-option.entity.ts
│   │   ├── product-popularity-snapshot.entity.ts
│   │   └── product.service.ts
│   ├── user/             # 사용자, 잔액변경로그 엔티티, 도메인 서비스
│   │   ├── user.entity.ts
│   │   ├── user-balance-change-log.entity.ts
│   │   └── user.service.ts
│   ├── common/           # 공통 도메인 예외, 에러코드 상수
│   │   ├── exceptions/
│   │   └── constants/
│   └── interfaces/       # 리포지토리 인터페이스 정의
│       └── *.repository.interface.ts
│
└── infrastructure/        # 인프라 계층
    ├── common/           # 인프라 유틸 (MutexManager)
    ├── modules/          # NestJS 모듈 설정
    ├── prisma/           # Prisma 설정, 트랜잭션 컨텍스트 (데코레이터 포함)
    ├── repositories/     # 리포지토리 구현체
    │   ├── memory-repository/  # 인메모리 구현
    │   └── prisma/             # Prisma 구현
    └── schedulers/       # 배치 스케줄러
        ├── order-expiration.scheduler.ts
        └── product-popularity.scheduler.ts
```

**계층별 역할:**

- **Presentation**: HTTP 요청/응답 처리, DTO 변환
- **Application**: 유스케이스 조합, 트랜잭션 경계
- **Domain**: 핵심 비즈니스 규칙 및 엔티티
- **Infrastructure**: 외부 의존성 (Repository, Module)

** 계층별 DTO **

- Presentation DTO: RequestDTO, ResponseDTO
  - Application ResultDTO를 의존함
- Application DTO: QueryDTO/CommandDTO, ResultDTO
  - Domain Entity를 의존함
  - CQRS 전환 가능하게 설계
  - 1개의 UseCase와 1개의 DTO는 1대1 대응
- Infrastructure DTO: toDomain Mapper, fromDomain Mapper
  - Domain Entity를 의존함

## ⏰ 배치 스케줄러

### 1. 인기 상품 스냅샷 (매일 자정)

- 최근 3일간 결제 완료된 주문 기준 Top 5 집계
- 판매량 동일 시 최근 결제 상품 우선 정렬

### 2. 주문 만료 처리 (30초마다)

- 10분 미결제 주문 자동 만료
- 선점 재고 자동 해제

### ⚠️ 분산 환경 제약사항

현재 배치 스케줄러는 **단일 서버 인스턴스에서만 안전하게 작동**합니다.

## 🔒 동시성 제어

### 구현 방식: 비관적 잠금(Pessimistic Lock) + 낙관적 잠금(Optimistic Lock)

현재 시스템은 **PostgreSQL 데이터베이스**와 **Prisma ORM**을 사용하여 트랜잭션 기반의 동시성 제어를 구현하고 있습니다.

### 1. 비관적 잠금 (Pessimistic Lock)

**적용 대상:**

- 상품 재고 관리 (`ProductOptionRepository`)
- 쿠폰 발급 수량 관리 (`CouponRepository`)

**구현 방식: `SELECT ... FOR UPDATE`**

```typescript
// 트랜잭션 컨텍스트 내에서 FOR UPDATE 사용
async findById(id: number): Promise<ProductOption | null> {
  const tx = this.prisma.getTransactionClient();

  if (tx) {
    // 비관적 잠금: 행 레벨 락 획득
    const recordList = await tx.$queryRaw`
      SELECT * FROM product_options WHERE id = ${id} FOR UPDATE
    `;
    return recordList.length > 0 ? this.mapToDomain(recordList[0]) : null;
  }

  return await this.prismaClient.product_options.findUnique({ where: { id } });
}
```

**동작 원리:**

1. 트랜잭션 시작 시 `FOR UPDATE`로 행(row) 레벨 락 획득
2. 다른 트랜잭션은 해당 행에 대해 대기 (직렬화)
3. 트랜잭션 커밋/롤백 시 자동으로 락 해제
4. 데이터베이스 레벨에서 동시성 보장

**적용 시나리오:**

- 주문 생성 시 재고 선점 (`reserveProductsForOrder`)
- 결제 완료 시 재고 확정 차감 (`confirmPaymentStock`)
- 쿠폰 발급 시 수량 차감 (`issueCouponToUser`)

### 2. 낙관적 잠금 (Optimistic Lock)

**적용 대상:**

- 사용자 잔액 변경 (`UserRepository`)

**구현 방식: `version` 필드 + 재시도 로직**

```typescript
// version 필드를 통한 낙관적 잠금
async update(user: User): Promise<User> {
  const updated = await this.prismaClient.users.updateMany({
    where: {
      id: user.id,
      version: user.version, // 현재 version으로 조건 검사
    },
    data: {
      balance: user.balance,
      version: user.version + 1, // version 증가
      updated_at: user.updatedAt,
    },
  });

  if (updated.count === 0) {
    throw new Error('Optimistic lock error: User update failed by version');
  }

  return await this.findById(user.id);
}
```

**재시도 로직:**

```typescript
// 도메인 서비스에서 재시도 처리
async chargeUser(userId: number, amount: number): Promise<User> {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const user = await this.getUser(userId);
      const { user: updatedUser, log } = user.charge(amount);

      await this.userRepository.update(updatedUser);
      await this.balanceLogRepository.create(log);

      return updatedUser;
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) throw error;

      // Exponential Backoff
      await new Promise(resolve =>
        setTimeout(resolve, Math.pow(2, attempt) * 10)
      );
    }
  }
}
```

**동작 원리:**

1. 엔티티 조회 시 현재 `version` 값 함께 조회
2. 업데이트 시 `WHERE version = {current_version}` 조건 추가
3. version이 일치하지 않으면 업데이트 실패 (동시 수정 감지)
4. 실패 시 재시도 (Exponential Backoff 적용)

**적용 시나리오:**

- 사용자 잔액 충전 (`chargeUser`)
- 사용자 잔액 차감 (`deductUser`)

### 3. 트랜잭션 경계 및 보상 트랜잭션

**트랜잭션 관리: Facade 계층**

```typescript
// 주문 생성: 재고 선점 + 주문 생성 원자적 처리
async createOrder(userId: number, items: OrderItemInput[]): Promise<OrderCreateView> {
  return await this.prisma.runInTransaction(async () => {
    // 1. 재고 선점 (비관적 잠금)
    const orderItemsData = await this.productService.reserveProductsForOrder(items);

    // 2. 주문 생성
    const createdOrder = await this.orderService.createPendingOrder(userId, totalAmount);

    // 3. 주문 항목 생성
    const createdOrderItems = await this.orderService.createOrderItems(createdOrder.id, orderItemsData);

    return orderView;
  });
}
```

**보상 트랜잭션: 결제 실패 시 롤백**

```typescript
async processPayment(orderId: number, userId: number, userCouponId?: number): Promise<OrderPaymentView> {
  try {
    // 1단계: 트랜잭션 - 쿠폰 사용 + 주문 상태 변경 + 재고 확정
    await this.prisma.runInTransaction(async () => {
      // 쿠폰 적용 (비관적 잠금)
      // 주문 상태 변경
      // 재고 확정 차감
    });

    // 2단계: 트랜잭션 외부 - 사용자 잔액 차감 (낙관적 잠금)
    const user = await this.userService.deductUser(userId, paymentAmount);

    return paymentView;
  } catch (error) {
    // 3단계: 보상 트랜잭션 - 롤백 처리
    await this.compensatePaymentFailure(orderId, appliedUserCouponId);
    throw error;
  }
}
```

### 동시성 제어 전략 선택 기준

| 구분          | 비관적 잠금              | 낙관적 잠금               |
| ------------- | ------------------------ | ------------------------- |
| **사용 시기** | 충돌 빈도가 높을 때      | 충돌 빈도가 낮을 때       |
| **적용 대상** | 재고, 쿠폰 수량          | 사용자 잔액               |
| **성능**      | 락 대기로 인한 지연 발생 | 충돌 시 재시도로 오버헤드 |
| **장점**      | 데이터 일관성 강력 보장  | 높은 동시성, 데드락 없음  |
| **단점**      | 동시성 낮음, 데드락 가능 | 재시도 로직 필요          |

### ⚠️ 분산 환경 고려사항

현재 구현은 **단일 데이터베이스 인스턴스 기준**입니다.

**다중 서버 환경 (이미 지원):**

```
Server 1 ─┐
Server 2 ─┼─→ PostgreSQL (단일 DB 인스턴스)
Server 3 ─┘
```

✅ DB 레벨 락이므로 여러 애플리케이션 서버에서도 동시성 제어 가능

**분산 DB 환경 (추가 구현 필요):**

- Redis 분산 락 (Redlock 알고리즘)
- DB 샤딩 시 분산 트랜잭션 관리
- Saga 패턴 또는 2PC(Two-Phase Commit)

## 📊 **테스트 및 품질**

| 항목            | 결과   |
| --------------- | ------ |
| 테스트 커버리지 | 86.98% |
| 단위 테스트     | 16개   |
| 통합 테스트     | 5개    |
| 동시성 테스트   | 통과   |
