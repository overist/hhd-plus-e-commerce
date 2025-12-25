import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { recordRequest } from '@common/monitoring/otel.metrics';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (process.env.METRICS_ENABLED === 'false') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    const method = request?.method ?? 'UNKNOWN';
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      finalize(() => {
        const end = process.hrtime.bigint();
        const durationSeconds = Number(end - start) / 1e9;

        const routePath = request?.route?.path;
        const baseUrl = request?.baseUrl ?? '';
        const route = routePath
          ? `${baseUrl}${routePath}`
          : (request?.path ?? 'unknown');

        const statusCode = response?.statusCode
          ? String(response.statusCode)
          : '0';

        // Record using OpenTelemetry metrics (OTLP -> Collector)
        try {
          recordRequest(method, route, statusCode, durationSeconds);
        } catch (err) {
          // don't break the request flow if metrics fail
          // eslint-disable-next-line no-console
          console.error('Failed to record OTEL metric', err);
        }
      }),
    );
  }
}
