import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ValidationException } from './validation-exception';

/**
 * Validation Exception Filter
 * 애플리케이션 수준 예외를 HTTP 응답으로 변환
 */
@Catch(ValidationException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: ValidationException, host: ArgumentsHost) {
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
