import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUTH_MODULE_OPTIONS,
  type AuthModuleOptions,
} from '../interfaces/jwt-payload.interface';
import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_MAX = 100;
const DEFAULT_WINDOW_MS = 60_000;
const CLEANUP_INTERVAL_MS = 60_000;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_MODULE_OPTIONS)
    private readonly options: AuthModuleOptions,
  ) {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    // Allow GC if this guard is destroyed without module teardown
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      connection?: { remoteAddress?: string };
      headers?: Record<string, string | undefined>;
    }>();
    const response = context.switchToHttp().getResponse<{
      setHeader(name: string, value: string | number): void;
    }>();

    const ip =
      request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ??
      request.ip ??
      request.connection?.remoteAddress ??
      'unknown';

    // IP whitelist bypass
    const whitelist = this.options.security?.ipFilter?.whitelist ?? [];
    if (whitelist.length > 0 && whitelist.includes(ip)) {
      return true;
    }

    // Per-endpoint override via @RateLimit() decorator
    const endpointConfig = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    const globalConfig = this.options.security?.rateLimit;
    const max = endpointConfig?.max ?? globalConfig?.max ?? DEFAULT_MAX;
    const windowMs =
      endpointConfig?.windowMs ?? globalConfig?.windowMs ?? DEFAULT_WINDOW_MS;

    const className = context.getClass().name;
    const handlerName = context.getHandler().name;
    const key = `${ip}:${className}:${handlerName}`;

    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      // New window
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    entry.count++;

    if (entry.count > max) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      response.setHeader('Retry-After', retryAfterSeconds);
      this.logger.warn(`Rate limit exceeded for ${key} (${entry.count}/${max})`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests, please try again later',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }
}
