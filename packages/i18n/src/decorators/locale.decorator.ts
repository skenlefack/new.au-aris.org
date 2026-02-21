import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { REQUEST_LOCALE_KEY } from '../i18n.middleware';
import { DEFAULT_LOCALE } from '../i18n.service';
import type { SupportedLocale } from '../i18n.service';

/**
 * Parameter decorator that extracts the resolved locale from the request.
 *
 * Usage:
 * ```typescript
 * @Get('hello')
 * hello(@Locale() locale: SupportedLocale) {
 *   return this.i18n.t('common.hello', locale);
 * }
 * ```
 */
export const Locale = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SupportedLocale => {
    const request = ctx.switchToHttp().getRequest<Record<string, unknown>>();
    return (request[REQUEST_LOCALE_KEY] as SupportedLocale) ?? DEFAULT_LOCALE;
  },
);
