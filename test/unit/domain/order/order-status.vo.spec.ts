import { OrderStatus } from '@/order/domain/entities/order-status.vo';

describe('OrderStatus', () => {
  describe('from', () => {
    it('given: "PENDING" 문자열이 주어짐 / when: from 메서드를 호출함 / then: PENDING 상태를 반환함', () => {
      // given
      const value = 'PENDING';

      // when
      const status = OrderStatus.from(value);

      // then
      expect(status).toBe(OrderStatus.PENDING);
      expect(status.get()).toBe('PENDING');
    });

    it('given: "PAID" 문자열이 주어짐 / when: from 메서드를 호출함 / then: PAID 상태를 반환함', () => {
      // given
      const value = 'PAID';

      // when
      const status = OrderStatus.from(value);

      // then
      expect(status).toBe(OrderStatus.PAID);
      expect(status.get()).toBe('PAID');
    });

    it('given: "CANCELLED" 문자열이 주어짐 / when: from 메서드를 호출함 / then: CANCELLED 상태를 반환함', () => {
      // given
      const value = 'CANCELLED';

      // when
      const status = OrderStatus.from(value);

      // then
      expect(status).toBe(OrderStatus.CANCELLED);
      expect(status.get()).toBe('CANCELLED');
    });

    it('given: "EXPIRED" 문자열이 주어짐 / when: from 메서드를 호출함 / then: EXPIRED 상태를 반환함', () => {
      // given
      const value = 'EXPIRED';

      // when
      const status = OrderStatus.from(value);

      // then
      expect(status).toBe(OrderStatus.EXPIRED);
      expect(status.get()).toBe('EXPIRED');
    });

    it('given: 소문자 "pending" 문자열이 주어짐 / when: from 메서드를 호출함 / then: PENDING 상태를 반환함', () => {
      // given
      const value = 'pending';

      // when
      const status = OrderStatus.from(value);

      // then
      expect(status).toBe(OrderStatus.PENDING);
    });

    it('given: 유효하지 않은 상태 문자열이 주어짐 / when: from 메서드를 호출함 / then: ValidationException을 발생시킴', () => {
      // given
      const value = 'INVALID';

      // when & then
      try {
        OrderStatus.from(value);
        fail('예외가 발생해야 합니다');
      } catch (error) {
        expect(error.name).toBe('ValidationException');
      }
    });
  });

  describe('get', () => {
    it('given: PENDING 상태가 주어짐 / when: get 메서드를 호출함 / then: "PENDING" 문자열을 반환함', () => {
      // given
      const status = OrderStatus.PENDING;

      // when
      const value = status.get();

      // then
      expect(value).toBe('PENDING');
    });
  });

  describe('isPending', () => {
    it('given: PENDING 상태가 주어짐 / when: isPending 메서드를 호출함 / then: true를 반환함', () => {
      // given
      const status = OrderStatus.PENDING;

      // when
      const result = status.isPending();

      // then
      expect(result).toBe(true);
    });

    it('given: PAID 상태가 주어짐 / when: isPending 메서드를 호출함 / then: false를 반환함', () => {
      // given
      const status = OrderStatus.PAID;

      // when
      const result = status.isPending();

      // then
      expect(result).toBe(false);
    });
  });

  describe('isPaid', () => {
    it('given: PAID 상태가 주어짐 / when: isPaid 메서드를 호출함 / then: true를 반환함', () => {
      // given
      const status = OrderStatus.PAID;

      // when
      const result = status.isPaid();

      // then
      expect(result).toBe(true);
    });

    it('given: PENDING 상태가 주어짐 / when: isPaid 메서드를 호출함 / then: false를 반환함', () => {
      // given
      const status = OrderStatus.PENDING;

      // when
      const result = status.isPaid();

      // then
      expect(result).toBe(false);
    });
  });

  describe('isCancelled', () => {
    it('given: CANCELLED 상태가 주어짐 / when: isCancelled 메서드를 호출함 / then: true를 반환함', () => {
      // given
      const status = OrderStatus.CANCELLED;

      // when
      const result = status.isCancelled();

      // then
      expect(result).toBe(true);
    });

    it('given: PENDING 상태가 주어짐 / when: isCancelled 메서드를 호출함 / then: false를 반환함', () => {
      // given
      const status = OrderStatus.PENDING;

      // when
      const result = status.isCancelled();

      // then
      expect(result).toBe(false);
    });
  });

  describe('isExpired', () => {
    it('given: EXPIRED 상태가 주어짐 / when: isExpired 메서드를 호출함 / then: true를 반환함', () => {
      // given
      const status = OrderStatus.EXPIRED;

      // when
      const result = status.isExpired();

      // then
      expect(result).toBe(true);
    });

    it('given: PENDING 상태가 주어짐 / when: isExpired 메서드를 호출함 / then: false를 반환함', () => {
      // given
      const status = OrderStatus.PENDING;

      // when
      const result = status.isExpired();

      // then
      expect(result).toBe(false);
    });
  });

  describe('equals', () => {
    it('given: 두 PENDING 상태가 주어짐 / when: equals 메서드를 호출함 / then: true를 반환함', () => {
      // given
      const status1 = OrderStatus.PENDING;
      const status2 = OrderStatus.PENDING;

      // when
      const result = status1.equals(status2);

      // then
      expect(result).toBe(true);
    });

    it('given: PENDING과 PAID 상태가 주어짐 / when: equals 메서드를 호출함 / then: false를 반환함', () => {
      // given
      const status1 = OrderStatus.PENDING;
      const status2 = OrderStatus.PAID;

      // when
      const result = status1.equals(status2);

      // then
      expect(result).toBe(false);
    });

    it('given: from으로 생성된 PENDING과 상수 PENDING이 주어짐 / when: equals 메서드를 호출함 / then: true를 반환함', () => {
      // given
      const status1 = OrderStatus.from('PENDING');
      const status2 = OrderStatus.PENDING;

      // when
      const result = status1.equals(status2);

      // then
      expect(result).toBe(true);
    });
  });
});
