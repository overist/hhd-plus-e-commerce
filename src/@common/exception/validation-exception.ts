import { ErrorCode } from './error-code';

/**
 * 애플리케이션 유효성 검증 예외
 */
export class ValidationException extends Error {
  constructor(
    public readonly errorCode: (typeof ErrorCode)[keyof typeof ErrorCode],
  ) {
    super(errorCode.message);
    this.name = 'ValidationException';
    Object.setPrototypeOf(this, ValidationException.prototype);
  }
}
