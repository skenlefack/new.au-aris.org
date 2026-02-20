import helmet from 'helmet';
import type { SecurityOptions } from './interfaces/jwt-payload.interface';

interface NestApp {
  use(...args: unknown[]): void;
  enableCors(options?: Record<string, unknown>): void;
}

export function applySecurityBootstrap(
  app: NestApp,
  options?: SecurityOptions,
): void {
  // Helmet — security headers
  if (options?.helmet !== false) {
    app.use(
      helmet({
        contentSecurityPolicy: false,
        hsts: { maxAge: 31536000, includeSubDomains: true },
        frameguard: { action: 'deny' },
        noSniff: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      }),
    );
  }

  // CORS
  if (options?.cors) {
    app.enableCors({
      origin: options.cors.origins ?? '*',
      credentials: options.cors.credentials ?? true,
      methods: options.cors.methods ?? [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
      ],
    });
  }
}
