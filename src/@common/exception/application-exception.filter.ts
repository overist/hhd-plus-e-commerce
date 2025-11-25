import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApplicationException } from './application-exception';

/**
 * Application Exception Filter
 * 애플리케이션 계층 예외를 HTTP 응답으로 변환
 */
@Catch(ApplicationException)
export class ApplicationExceptionFilter implements ExceptionFilter {
  catch(exception: ApplicationException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = HttpStatus.BAD_REQUEST;

    response.status(status).json({
      errorCode: exception.errorCode.code,
      message: exception.errorCode.message,
      timestamp: new Date().toISOString(),
    });
  }
}
