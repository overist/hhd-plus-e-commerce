# 🏗️ 아키텍처 설계 문서

## 개요

이 문서는 hhplus-e-commerce 프로젝트의 아키텍처 설계 원칙과 패턴을 상세히 설명합니다.

---

## 📁 폴더 구조

```
src/
├── @auth/                    # 인증 모듈
├── @common/                  # 공통 모듈
├── @schedulers/              # 배치 스케줄러
├── cart/                     # 장바구니 도메인 모듈
│   ├── cart.module.ts
│   ├── application/          # 유즈케이스 계층
│   │   ├── add-cart.use-case.ts
│   │   ├── get-cart.use-case.ts
│   │   ├── remove-cart.use-case.ts
│   │   └── dto/
│   ├── domain/               # 도메인 계층
│   │   ├── entities/
│   │   ├── interfaces/
│   │   └── services/
│   ├── infrastructure/       # 인프라 계층
│   │   ├── cart.prisma.repository.ts
│   │   └── cart.memory.repository.ts
│   └── presentation/         # 프레젠테이션 계층
│       ├── cart.controller.ts
│       └── dto/
│
├── coupon/                   # 쿠폰 도메인 모듈
│   ├── coupon.module.ts
│   ├── application/
│   │   ├── issue-coupon.use-case.ts
│   │   ├── get-user-coupons.use-case.ts
│   │   └── dto/
│   ├── domain/
│   │   ├── entities/
│   │   ├── interfaces/
│   │   └── services/
│   ├── infrastructure/
│   └── presentation/
│
├── order/                    # 주문 도메인 모듈
│   ├── order.module.ts
│   ├── application/
│   │   ├── create-order.use-case.ts
│   │   ├── process-payment.use-case.ts
│   │   ├── get-orders.use-case.ts
│   │   ├── get-order-detail.use-case.ts
│   │   └── dto/
│   ├── domain/
│   │   ├── entities/
│   │   ├── interfaces/
│   │   └── services/
│   ├── infrastructure/
│   └── presentation/
│
├── product/                  # 상품 도메인 모듈
│   ├── product.module.ts
│   ├── application/
│   │   ├── get-products.use-case.ts
│   │   ├── get-product-detail.use-case.ts
│   │   ├── get-top-products.use-case.ts
│   │   ├── update-stock.use-case.ts
│   │   └── dto/
│   ├── domain/
│   │   ├── entities/
│   │   ├── interfaces/
│   │   └── services/
│   ├── infrastructure/
│   └── presentation/
│
├── user/                     # 사용자 도메인 모듈
│   ├── user.module.ts
│   ├── application/
│   │   ├── charge-balance.use-case.ts
│   │   ├── get-balance.use-case.ts
│   │   ├── get-balance-logs.use-case.ts
│   │   └── dto/
│   ├── domain/
│   │   ├── entities/
│   │   ├── interfaces/
│   │   └── services/
│   ├── infrastructure/
│   └── presentation/
│
├── app.module.ts
└── main.ts
```

---

## 🎯 계층별 역할과 책임

### 1. Presentation Layer (프레젠테이션 계층)

**역할:** HTTP 요청/응답 처리, DTO 변환, API 문서화

**구성 요소:**

- `*.controller.ts`: 라우팅, HTTP 메서드 매핑
- `dto/`: Request/Response DTO

**특징:**

- Swagger 데코레이터로 API 문서 자동 생성
- `class-validator`로 입력 값 검증
- Application DTO로 변환하는 정적 메서드 제공

```typescript
// presentation/dto/add-cart.dto.ts
export class AddCartRequest {
  @ApiProperty({ description: '상품 옵션 ID' })
  @IsInt()
  @IsPositive()
  productOptionId: number;

  @ApiProperty({ description: '수량' })
  @IsInt()
  @Min(1)
  quantity: number;

  // Presentation → Application 변환
  static toCommand(userId: number, dto: AddCartRequest): AddCartCommand {
    const command = new AddCartCommand();
    command.userId = userId;
    command.productOptionId = dto.productOptionId;
    command.quantity = dto.quantity;
    return command;
  }
}
```

---

### 2. Application Layer (애플리케이션 계층)

**역할:** 유즈케이스 실행, 트랜잭션 경계, 도메인 서비스 조합

**구성 요소:**

- `*.use-case.ts`: 단일 비즈니스 유즈케이스
- `dto/`: Command/Query/Result DTO

**설계 원칙:**

- **1 UseCase = 1 기능**: 단일 책임 원칙
- **CQRS 패턴**: Command(변경)와 Query(조회) 분리
- **트랜잭션 관리**: `PrismaService.runInTransaction()` 사용

```typescript
// application/create-order.use-case.ts
@Injectable()
export class CreateOrderUseCase {
  constructor(
    private readonly orderService: OrderDomainService,
    private readonly productService: ProductDomainService,
    private readonly userService: UserDomainService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: CreateOrderCommand): Promise<CreateOrderResult> {
    return await this.prisma.runInTransaction(async () => {
      // 1. 사용자 존재 확인
      await this.userService.getUser(cmd.userId);

      // 2. 재고 선점
      const orderItemsData = await this.productService.reserveProductsForOrder(
        cmd.items,
      );

      // 3. 주문 생성
      const order = await this.orderService.createPendingOrder(
        cmd.userId,
        totalAmount,
      );

      // 4. 주문 항목 생성
      const orderItems = await this.orderService.createOrderItems(
        order.id,
        orderItemsData,
      );

      return CreateOrderResult.fromDomain(order, orderItems);
    });
  }
}
```

---

### 3. Domain Layer (도메인 계층)

**역할:** 핵심 비즈니스 규칙, 엔티티, 도메인 서비스

**구성 요소:**

- `entities/`: 도메인 엔티티 및 Value Object
- `services/`: 도메인 서비스
- `interfaces/`: 레포지토리 인터페이스 (Port)

**Rich Domain Model 적용:**

```typescript
// domain/entities/cart-item.entity.ts
export class CartItem {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly productOptionId: number,
    public quantity: number,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    this.validateQuantity(); // 생성 시 검증
  }

  // 비즈니스 규칙이 엔티티 내부에 존재
  increaseQuantity(amount: number): void {
    if (amount <= 0) {
      throw new DomainException(ErrorCode.INVALID_QUANTITY);
    }
    this.quantity += amount;
    this.updatedAt = new Date();
  }

  validateOwnership(userId: number): void {
    if (this.userId !== userId) {
      throw new DomainException(ErrorCode.UNAUTHORIZED);
    }
  }

  shouldBeRemoved(): boolean {
    return this.quantity <= 1;
  }
}
```

**의존성 역전 원칙 (DIP):**

```typescript
// domain/interfaces/cart.repository.interface.ts
export abstract class ICartRepository {
  abstract findById(id: number): Promise<CartItem | null>;
  abstract findManyByUserId(userId: number): Promise<CartItem[]>;
  abstract create(
    userId: number,
    productOptionId: number,
    quantity: number,
  ): Promise<CartItem>;
  abstract update(cartItem: CartItem): Promise<CartItem>;
  abstract delete(id: number): Promise<void>;
}
```

---

### 4. Infrastructure Layer (인프라 계층)

**역할:** 외부 시스템 연동, 레포지토리 구현체

**구성 요소:**

- `*.prisma.repository.ts`: Prisma 구현체
- `*.memory.repository.ts`: 인메모리 구현체 (테스트용)

**트랜잭션 컨텍스트 지원:**

```typescript
// infrastructure/cart.prisma.repository.ts
@Injectable()
export class CartRepository implements ICartRepository {
  constructor(private readonly prisma: PrismaService) {}

  // 트랜잭션 컨텍스트가 있으면 해당 클라이언트 사용
  private get prismaClient(): Prisma.TransactionClient | PrismaService {
    return this.prisma.getClient();
  }

  async findById(id: number): Promise<CartItem | null> {
    const record = await this.prismaClient.cart_items.findUnique({
      where: { id: BigInt(id) },
    });
    return record ? this.mapToDomain(record) : null;
  }
}
```

---

## 📋 DTO 설계 패턴

### 계층별 DTO 분리

| 계층             | 네이밍 패턴                               | 역할                        |
| ---------------- | ----------------------------------------- | --------------------------- |
| **Presentation** | `{Action}Request`, `{Action}Response`     | HTTP 요청/응답, 유효성 검증 |
| **Application**  | `{Action}Command/Query`, `{Action}Result` | 유즈케이스 입출력           |

### CQRS 패턴 적용

- **Command**: 데이터 변경 작업 (Create, Update, Delete)
- **Query**: 데이터 조회 작업 (Read)

```
AddCartCommand     → 장바구니 추가 (변경)
GetCartQuery       → 장바구니 조회 (조회)
```

### DTO 변환 메서드

```typescript
// Presentation → Application (toCommand/toQuery)
static toCommand(userId: number, dto: AddCartRequest): AddCartCommand { ... }

// Domain → Application (fromDomain)
static fromDomain(cartItem: CartItem, option: ProductOption, product: Product): GetCartResult { ... }
```

---

## 🔄 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                      Presentation Layer                         │
│  ┌──────────────┐    ┌─────────────────────────────────────┐   │
│  │  Controller  │ ←→ │  Request/Response DTOs              │   │
│  │              │    │  (@ApiProperty, @IsInt, toCommand)  │   │
│  └──────────────┘    └─────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                          │
│  ┌──────────────┐    ┌─────────────────────────────────────┐   │
│  │   UseCases   │ ←→ │  Command/Query/Result DTOs          │   │
│  │  (execute)   │    │  (fromDomain)                       │   │
│  └──────────────┘    └─────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Domain Layer                             │
│  ┌──────────────────┐    ┌────────────────────────────────┐    │
│  │  DomainService   │ →  │  Entity (Rich Domain Model)    │    │
│  │  (비즈니스 조합)  │    │  (비즈니스 규칙, 검증)          │    │
│  └──────────────────┘    └────────────────────────────────┘    │
│           ↓                                                     │
│  ┌──────────────────┐                                           │
│  │  IRepository     │  ← 추상 인터페이스 (Port)                 │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                         │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Repository (Adapter 구현체)                   │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 설계 원칙 요약

| 원칙                       | 적용 방식                                            |
| -------------------------- | ---------------------------------------------------- |
| **단일 책임 원칙 (SRP)**   | 1 UseCase = 1 기능                                   |
| **의존성 역전 원칙 (DIP)** | 도메인은 `IRepository` 인터페이스에 의존             |
| **CQRS 패턴**              | `Command`(변경) vs `Query`(조회) 분리                |
| **Rich Domain Model**      | 엔티티에 비즈니스 규칙 포함                          |
| **DTO 변환 패턴**          | `toCommand()`, `fromDomain()` 정적 메서드            |
| **계층 분리**              | Presentation → Application → Domain → Infrastructure |
| **모듈 단위 구성**         | 도메인별 독립 모듈 (cart, order, user 등)            |
