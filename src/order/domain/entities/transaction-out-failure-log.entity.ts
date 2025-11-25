/**
 * TransactionOutFailureLog Entity
 * 외부 데이터 전송 실패 로그 (Append-only)
 * BR-017: 외부 데이터 전송 실패 이력은 별도 로그로 기록한다
 * RF-020: 외부 데이터 전송 실패는 주문 완료를 방해하지 않아야 한다
 */
export class TransactionOutFailureLog {
  constructor(
    public readonly id: number,
    public readonly orderId: number,
    public readonly payload: string,
    public readonly errorMessage: string | null,
    public readonly retryCount: number,
    public readonly createdAt: Date,
  ) {}
}
