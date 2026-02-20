import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import {
  AUTH_MODULE_OPTIONS,
  type AuthModuleOptions,
} from '../interfaces/jwt-payload.interface';

@Injectable()
export class IpFilterGuard implements CanActivate {
  constructor(
    @Inject(AUTH_MODULE_OPTIONS)
    private readonly options: AuthModuleOptions,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const ipFilter = this.options.security?.ipFilter;
    if (!ipFilter) {
      return true;
    }

    const whitelist = ipFilter.whitelist ?? [];
    const blacklist = ipFilter.blacklist ?? [];

    if (whitelist.length === 0 && blacklist.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      ip?: string;
      connection?: { remoteAddress?: string };
      headers?: Record<string, string | undefined>;
    }>();

    const ip =
      request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ??
      request.ip ??
      request.connection?.remoteAddress ??
      'unknown';

    if (blacklist.includes(ip)) {
      throw new ForbiddenException('Access denied');
    }

    if (whitelist.length > 0 && !whitelist.includes(ip)) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
