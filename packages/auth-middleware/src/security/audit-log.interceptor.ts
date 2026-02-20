import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      ip?: string;
      connection?: { remoteAddress?: string };
      headers?: Record<string, string | undefined>;
      user?: AuthenticatedUser;
    }>();

    const method = request.method;
    const url = request.url;
    const ip =
      request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ??
      request.ip ??
      request.connection?.remoteAddress ??
      'unknown';
    const userId = request.user?.userId ?? 'anonymous';
    const tenantId = request.user?.tenantId ?? 'none';
    const role = request.user?.role ?? 'none';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<{ statusCode: number }>();
          const duration = Date.now() - start;
          this.logger.log(
            `${method} ${url} ${response.statusCode} ${duration}ms — ip=${ip} user=${userId} tenant=${tenantId} role=${role}`,
          );
        },
        error: (error: unknown) => {
          const duration = Date.now() - start;
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `${method} ${url} ERROR ${duration}ms — ip=${ip} user=${userId} tenant=${tenantId} role=${role} error=${message}`,
          );
        },
      }),
    );
  }
}
