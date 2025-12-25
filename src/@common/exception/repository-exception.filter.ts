import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { RepositoryException } from './repository-exception';
import { ErrorCode } from './error-code';

/**
 * Repository Exception Filter
 * 리포지토리 계층 예외를 HTTP 응답으로 변환
 */
@Catch(RepositoryException)
export class RepositoryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RepositoryExceptionFilter.name);

  catch(exception: RepositoryException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 원인 예외가 있으면 로깅
    if (exception.cause) {
      this.logger.error(
        `RepositoryException: ${exception.errorCode.code} - ${exception.message}`,
        exception.cause.stack,
      );
    }

    const status = this.getHttpStatus(exception.errorCode);

    response.status(status).json({
      errorCode: exception.errorCode.code,
      message: exception.errorCode.message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * ErrorCode에 따라 적절한 HTTP 상태 코드 반환
   * - 인프라(Repository) 예외도 도메인 예외와 동일한 HTTP 규칙을 적용
   */
  private getHttpStatus(
    errorCode: (typeof ErrorCode)[keyof typeof ErrorCode],
  ): number {
    const code = errorCode.code;

    // 404 Not Found
    if (
      ['P001', 'P004', 'O002', 'U001', 'C006', 'C007', 'CART001'].includes(code)
    ) {
      return HttpStatus.NOT_FOUND;
    }

    // 403 Forbidden (권한 없음)
    if (['O005', 'CART002'].includes(code)) {
      return HttpStatus.FORBIDDEN;
    }

    // 400 Bad Request (비즈니스 규칙 위반 / 검증 실패)
    if (
      [
        'P002',
        'P003',
        'O001',
        'O003',
        'O004',
        'O006',
        'PAY001',
        'PAY002',
        'C001',
        'C002',
        'C003',
        'C004',
        'C005',
      ].includes(code)
    ) {
      return HttpStatus.BAD_REQUEST;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
