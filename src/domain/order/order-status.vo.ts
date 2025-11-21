import { ValidationException } from '@domain/common/exceptions/domain.exception';

/**
 * OrderStatus Value Object
 * 주문 상태를 나타내는 값 객체
 */
export class OrderStatus {
  private constructor(public readonly value: string) {}

  static readonly PENDING = new OrderStatus('PENDING');
  static readonly PAID = new OrderStatus('PAID');
  static readonly CANCELLED = new OrderStatus('CANCELLED');
  static readonly EXPIRED = new OrderStatus('EXPIRED');

  static from(value: string): OrderStatus {
    const normalized = value.toUpperCase();
    switch (normalized) {
      case 'PENDING':
        return OrderStatus.PENDING;
      case 'PAID':
        return OrderStatus.PAID;
      case 'CANCELLED':
        return OrderStatus.CANCELLED;
      case 'EXPIRED':
        return OrderStatus.EXPIRED;
      default:
        throw new ValidationException(
          `유효하지 않은 주문 상태: ${value}` as any,
        );
    }
  }

  get(): string {
    return this.value;
  }

  isPending(): boolean {
    return this === OrderStatus.PENDING;
  }

  isPaid(): boolean {
    return this === OrderStatus.PAID;
  }

  isCancelled(): boolean {
    return this === OrderStatus.CANCELLED;
  }

  isExpired(): boolean {
    return this === OrderStatus.EXPIRED;
  }

  equals(other: OrderStatus): boolean {
    return this === other;
  }
}
