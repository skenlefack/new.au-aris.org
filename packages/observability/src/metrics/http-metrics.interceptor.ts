import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import * as client from 'prom-client';

const PREFIX = 'aris_http_';

const requestCounter = new client.Counter({
  name: `${PREFIX}requests_total`,
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'] as const,
});

const requestDuration = new client.Histogram({
  name: `${PREFIX}request_duration_seconds`,
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const activeRequests = new client.Gauge({
  name: `${PREFIX}requests_in_flight`,
  help: 'Number of HTTP requests currently being processed',
  labelNames: ['method'] as const,
});

function normalizePath(url: string): string {
  return url
    .split('?')[0]
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id',
    )
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
    }>();
    const method = request.method;
    const path = normalizePath(request.url);
    const end = requestDuration.startTimer({ method, path });

    activeRequests.inc({ method });

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context
            .switchToHttp()
            .getResponse<{ statusCode: number }>();
          const status = String(response.statusCode);
          end({ status });
          requestCounter.inc({ method, path, status });
          activeRequests.dec({ method });
        },
        error: (error: unknown) => {
          const status = String(
            (error as { status?: number })?.status ?? 500,
          );
          end({ status });
          requestCounter.inc({ method, path, status });
          activeRequests.dec({ method });
        },
      }),
    );
  }
}
