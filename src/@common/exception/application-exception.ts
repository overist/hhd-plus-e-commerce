import { ErrorCode } from './error-code';

/**
 * 애플리케이션 계층 예외
 * Use Case에서 발생하는 비즈니스 로직 예외
 */
export class ApplicationException extends Error {
  constructor(
    public readonly errorCode: (typeof ErrorCode)[keyof typeof ErrorCode],
  ) {
    super(errorCode.message);
    this.name = 'ApplicationException';
    Object.setPrototypeOf(this, ApplicationException.prototype);
  }
}
