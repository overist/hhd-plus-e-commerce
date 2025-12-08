import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { RepositoryException } from './repository-exception';

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

    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      errorCode: exception.errorCode.code,
      message: exception.errorCode.message,
      timestamp: new Date().toISOString(),
    });
  }
}
