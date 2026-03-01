import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { SupportedLocale } from '@aris/i18n';

export async function registerI18nRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/i18n/enums — public
  app.get('/api/v1/i18n/enums', async (request: FastifyRequest<{ Querystring: { locale?: string } }>) => {
    const locale = (request.query.locale ?? 'en') as SupportedLocale;
    return { data: app.i18n.getAllEnumTranslations(locale) };
  });

  // GET /api/v1/i18n/locales — public
  app.get('/api/v1/i18n/locales', async () => {
    return {
      data: [
        { code: 'en', nameEn: 'English', nameNative: 'English', rtl: false },
        { code: 'fr', nameEn: 'French', nameNative: 'Fran\u00e7ais', rtl: false },
        { code: 'pt', nameEn: 'Portuguese', nameNative: 'Portugu\u00eas', rtl: false },
        { code: 'ar', nameEn: 'Arabic', nameNative: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', rtl: true },
        { code: 'es', nameEn: 'Spanish', nameNative: 'Espa\u00f1ol', rtl: false },
      ],
    };
  });
}
