import { Injectable, NestMiddleware } from '@nestjs/common';
import helmet from 'helmet';

const helmetMiddleware = helmet({
  contentSecurityPolicy: false, // CSP managed by frontend frameworks
  hsts: { maxAge: 31536000, includeSubDomains: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

@Injectable()
export class HelmetMiddleware implements NestMiddleware {
  use(req: unknown, res: unknown, next: () => void): void {
    (helmetMiddleware as (req: unknown, res: unknown, next: () => void) => void)(
      req,
      res,
      next,
    );
  }
}
