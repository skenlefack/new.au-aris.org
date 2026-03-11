import { LoggerService, Injectable, Scope } from '@nestjs/common';
import { trace as otelTrace, context as otelContext } from '@opentelemetry/api';

export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  message: string;
  service?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  context?: string;
  [key: string]: unknown;
}

@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLogger implements LoggerService {
  private context = '';
  private serviceName = '';
  private static correlationStore = new Map<number, string>();

  setContext(context: string): void {
    this.context = context;
  }

  setServiceName(name: string): void {
    this.serviceName = name;
  }

  static setCorrelationId(id: string): void {
    // In a real async context, you'd use AsyncLocalStorage.
    // This is a simplified version using the current timestamp as key.
    StructuredLogger.currentCorrelationId = id;
  }

  static currentCorrelationId = '';

  log(message: string, ...optionalParams: unknown[]): void {
    this.writeLog('info', message, optionalParams);
  }

  error(message: string, ...optionalParams: unknown[]): void {
    this.writeLog('error', message, optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    this.writeLog('warn', message, optionalParams);
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    this.writeLog('debug', message, optionalParams);
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    this.writeLog('verbose', message, optionalParams);
  }

  private writeLog(
    level: string,
    message: string,
    optionalParams: unknown[],
  ): void {
    let ctx = this.context;
    let stack: string | undefined;

    if (level === 'error') {
      // NestJS error() convention: error(message, stack?, context?)
      // optionalParams[0] = stack trace (string or Error)
      // optionalParams[1] = context (string)
      if (optionalParams.length >= 2 && typeof optionalParams[1] === 'string') {
        ctx = optionalParams[1] as string;
      }
      if (optionalParams.length >= 1) {
        const traceParam = optionalParams[0];
        if (typeof traceParam === 'string') {
          stack = traceParam;
        } else if (traceParam instanceof Error) {
          stack = traceParam.stack;
        }
      }
    } else {
      // For non-error levels: last string param is context
      if (
        optionalParams.length > 0 &&
        typeof optionalParams[optionalParams.length - 1] === 'string'
      ) {
        ctx = optionalParams.pop() as string;
      }
    }

    // Extract OTel trace context for log-trace correlation
    const activeSpan = otelTrace.getSpan(otelContext.active());
    const spanContext = activeSpan?.spanContext();

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName || undefined,
      correlationId: StructuredLogger.currentCorrelationId || undefined,
      traceId: spanContext?.traceId || undefined,
      spanId: spanContext?.spanId || undefined,
      context: ctx || undefined,
    };

    if (stack) {
      entry.stack = stack;
    }

    const output = JSON.stringify(entry);

    if (level === 'error') {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }
}
