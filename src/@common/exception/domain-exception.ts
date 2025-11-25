import { ErrorCode } from './error-code';

/**
 * 도메인 비즈니스 규칙 위반 예외
 */
export class DomainException extends Error {
  constructor(
    public readonly errorCode: (typeof ErrorCode)[keyof typeof ErrorCode],
  ) {
    super(errorCode.message);
    this.name = 'DomainException';
    Object.setPrototypeOf(this, DomainException.prototype);
  }
}
