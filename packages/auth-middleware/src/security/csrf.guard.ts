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

const DEFAULT_CSRF_COOKIE = 'XSRF-TOKEN';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    @Inject(AUTH_MODULE_OPTIONS)
    private readonly options: AuthModuleOptions,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.options.security?.csrf) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      method: string;
      headers: Record<string, string | undefined>;
      cookies?: Record<string, string | undefined>;
    }>();

    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const cookieName =
      this.options.security.csrfCookieName ?? DEFAULT_CSRF_COOKIE;

    const cookieValue = request.cookies?.[cookieName];
    const headerValue = request.headers['x-csrf-token'];

    if (!cookieValue || !headerValue) {
      throw new ForbiddenException('CSRF token missing');
    }

    if (cookieValue !== headerValue) {
      throw new ForbiddenException('CSRF token mismatch');
    }

    return true;
  }
}
