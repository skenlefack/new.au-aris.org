import { Injectable, Logger } from '@nestjs/common';
import * as en from './translations/en.json';
import * as fr from './translations/fr.json';
import * as pt from './translations/pt.json';
import * as ar from './translations/ar.json';
import * as es from './translations/es.json';

export type SupportedLocale = 'en' | 'fr' | 'pt' | 'ar' | 'es';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'fr', 'pt', 'ar', 'es'];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

type TranslationMap = Record<string, unknown>;

const TRANSLATIONS: Record<SupportedLocale, TranslationMap> = {
  en: en as unknown as TranslationMap,
  fr: fr as unknown as TranslationMap,
  pt: pt as unknown as TranslationMap,
  ar: ar as unknown as TranslationMap,
  es: es as unknown as TranslationMap,
};

@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);

  /**
   * Translate a key with optional interpolation parameters.
   * Supports dot-notation keys like "common.save" or "enums.UserRole.SUPER_ADMIN".
   * Falls back to English if the key is missing in the requested locale.
   * Returns the key itself if not found in any locale.
   */
  t(key: string, locale?: SupportedLocale | string, params?: Record<string, string | number>): string {
    const resolvedLocale = this.resolveLocale(locale);
    let value = this.lookup(key, resolvedLocale);

    // Fallback to English
    if (value === undefined && resolvedLocale !== 'en') {
      value = this.lookup(key, 'en');
    }

    // Return key if not found
    if (value === undefined) {
      this.logger.warn(`Missing translation: ${key} [${resolvedLocale}]`);
      return key;
    }

    // Interpolate parameters: {{paramName}}
    if (params) {
      return this.interpolate(value, params);
    }

    return value;
  }

  /**
   * Get all translations for a given enum type.
   * e.g., getEnumTranslations('UserRole', 'fr') returns { SUPER_ADMIN: 'Super administrateur', ... }
   */
  getEnumTranslations(enumName: string, locale?: SupportedLocale | string): Record<string, string> {
    const resolvedLocale = this.resolveLocale(locale);
    const enumSection = this.lookupRaw('enums', resolvedLocale) as Record<string, Record<string, string>> | undefined;

    if (enumSection && enumSection[enumName]) {
      return enumSection[enumName];
    }

    // Fallback to English
    if (resolvedLocale !== 'en') {
      const enSection = this.lookupRaw('enums', 'en') as Record<string, Record<string, string>> | undefined;
      if (enSection && enSection[enumName]) {
        return enSection[enumName];
      }
    }

    return {};
  }

  /**
   * Get all enum translations for a locale (all enum types).
   */
  getAllEnumTranslations(locale?: SupportedLocale | string): Record<string, Record<string, string>> {
    const resolvedLocale = this.resolveLocale(locale);
    const enumSection = this.lookupRaw('enums', resolvedLocale) as Record<string, Record<string, string>> | undefined;

    if (enumSection) {
      return enumSection;
    }

    // Fallback to English
    if (resolvedLocale !== 'en') {
      const enSection = this.lookupRaw('enums', 'en') as Record<string, Record<string, string>> | undefined;
      if (enSection) {
        return enSection;
      }
    }

    return {};
  }

  /**
   * Extract locale from Accept-Language header or fallback.
   * Supports: "fr", "fr-FR", "fr-FR,en;q=0.9", etc.
   */
  getLocale(acceptLanguageHeader?: string): SupportedLocale {
    if (!acceptLanguageHeader) {
      return DEFAULT_LOCALE;
    }

    // Parse Accept-Language header: "fr-FR,fr;q=0.9,en;q=0.8"
    const locales = acceptLanguageHeader
      .split(',')
      .map((part) => {
        const [lang, qualityStr] = part.trim().split(';q=');
        const quality = qualityStr ? parseFloat(qualityStr) : 1.0;
        // Extract base language: "fr-FR" → "fr"
        const baseLang = lang.trim().split('-')[0].toLowerCase();
        return { lang: baseLang, quality };
      })
      .sort((a, b) => b.quality - a.quality);

    for (const { lang } of locales) {
      if (this.isSupportedLocale(lang)) {
        return lang;
      }
    }

    return DEFAULT_LOCALE;
  }

  /**
   * Get list of supported locales.
   */
  getSupportedLocales(): SupportedLocale[] {
    return [...SUPPORTED_LOCALES];
  }

  /**
   * Check if a locale is supported.
   */
  isSupportedLocale(locale: string): locale is SupportedLocale {
    return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
  }

  /**
   * Check if a locale is RTL (Right-to-Left).
   */
  isRtl(locale: SupportedLocale | string): boolean {
    return this.resolveLocale(locale) === 'ar';
  }

  // ── Private helpers ──

  private resolveLocale(locale?: SupportedLocale | string): SupportedLocale {
    if (!locale) return DEFAULT_LOCALE;
    const base = locale.split('-')[0].toLowerCase();
    return this.isSupportedLocale(base) ? base : DEFAULT_LOCALE;
  }

  private lookup(key: string, locale: SupportedLocale): string | undefined {
    const result = this.lookupRaw(key, locale);
    return typeof result === 'string' ? result : undefined;
  }

  private lookupRaw(key: string, locale: SupportedLocale): unknown {
    const translations = TRANSLATIONS[locale];
    if (!translations) return undefined;

    const parts = key.split('.');
    let current: unknown = translations;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private interpolate(template: string, params: Record<string, string | number>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, paramName: string) => {
      const value = params[paramName];
      return value !== undefined ? String(value) : match;
    });
  }
}
