import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainException } from '@domain/common/exceptions/domain.exception';
import { ErrorCode } from '@domain/common/constants/error-code';

/**
 * Domain Exception Filter
 * 도메인 예외를 HTTP 응답으로 변환
 */
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = this.getHttpStatus(exception.errorCode);

    response.status(status).json({
      errorCode: exception.errorCode.code,
      message: exception.errorCode.message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * ErrorCode에 따라 적절한 HTTP 상태 코드 반환
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

    // 400 Bad Request
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

    // 기본값 500 Internal Server Error
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
