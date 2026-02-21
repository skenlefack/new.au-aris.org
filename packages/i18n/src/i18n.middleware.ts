import { Injectable, type NestMiddleware } from '@nestjs/common';
import { I18nService } from './i18n.service';
import type { SupportedLocale } from './i18n.service';

/** Key used to store locale on the request object */
export const REQUEST_LOCALE_KEY = 'locale';

interface IncomingRequest {
  headers: Record<string, string | string[] | undefined>;
  [key: string]: unknown;
}

/**
 * Middleware that extracts locale from:
 * 1. X-Locale header (explicit override, e.g., from JWT user preference)
 * 2. Accept-Language header (browser/client preference)
 * 3. Default: 'en'
 *
 * Sets req.locale for downstream use via @Locale() decorator.
 */
@Injectable()
export class I18nMiddleware implements NestMiddleware {
  constructor(private readonly i18n: I18nService) {}

  use(req: IncomingRequest, _res: unknown, next: () => void): void {
    // Priority 1: Explicit X-Locale header (set by frontend or from JWT)
    const explicitLocale = req.headers['x-locale'] as string | undefined;
    if (explicitLocale && this.i18n.isSupportedLocale(explicitLocale)) {
      req[REQUEST_LOCALE_KEY] = explicitLocale;
      next();
      return;
    }

    // Priority 2: Accept-Language header
    const acceptLanguage = req.headers['accept-language'] as string | undefined;
    const locale: SupportedLocale = this.i18n.getLocale(acceptLanguage);
    req[REQUEST_LOCALE_KEY] = locale;

    next();
  }
}
