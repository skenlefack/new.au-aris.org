// Module
export { I18nModule } from './i18n.module';

// Service
export { I18nService } from './i18n.service';
export type { SupportedLocale } from './i18n.service';
export { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './i18n.service';

// Middleware
export { I18nMiddleware, REQUEST_LOCALE_KEY } from './i18n.middleware';

// Decorators
export { Locale } from './decorators/locale.decorator';
