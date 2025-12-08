import { ErrorCode } from './error-code';

/**
 * 리포지토리 계층 예외
 * 데이터 접근 및 영속성 관련 예외
 */
export class RepositoryException extends Error {
  constructor(
    public readonly errorCode: (typeof ErrorCode)[keyof typeof ErrorCode],
    public readonly cause?: Error,
  ) {
    super(errorCode.message);
    this.name = 'RepositoryException';
    Object.setPrototypeOf(this, RepositoryException.prototype);
  }
}
