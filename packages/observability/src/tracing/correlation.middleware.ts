import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { StructuredLogger } from '../logging/structured-logger';

const CORRELATION_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(
    req: {
      headers: Record<string, string | string[] | undefined>;
      correlationId?: string;
    },
    res: { setHeader(name: string, value: string): void },
    next: () => void,
  ): void {
    const incoming = req.headers[CORRELATION_HEADER];
    const correlationId =
      typeof incoming === 'string' && incoming.length > 0
        ? incoming
        : randomUUID();

    // Attach to request for downstream use
    req.correlationId = correlationId;

    // Echo back in response
    res.setHeader(CORRELATION_HEADER, correlationId);

    // Set on structured logger for this request context
    StructuredLogger.setCorrelationId(correlationId);

    next();
  }
}

export { CORRELATION_HEADER };
