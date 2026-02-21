'use client';

import { useLocaleStore } from '@/lib/stores/locale-store';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import pt from '@/messages/pt.json';
import type { Locale } from './config';

const messages: Record<Locale, Record<string, Record<string, string>>> = { en, fr, pt };

/**
 * Hook that returns translation function for a namespace.
 * Usage: const t = useTranslations('dashboard');
 *        t('title') -> 'Dashboard'
 */
export function useTranslations(namespace: string) {
  const locale = useLocaleStore((s) => s.locale);
  const ns = messages[locale]?.[namespace] ?? messages.en[namespace] ?? {};

  return function t(key: string, params?: Record<string, string | number>): string {
    let value = ns[key] ?? messages.en[namespace]?.[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, String(v));
      });
    }
    return value;
  };
}

/**
 * Format a date according to the current locale.
 */
export function useFormattedDate() {
  const locale = useLocaleStore((s) => s.locale);
  const localeMap: Record<Locale, string> = { en: 'en-GB', fr: 'fr-FR', pt: 'pt-PT' };

  return function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(localeMap[locale], options ?? { year: 'numeric', month: 'short', day: 'numeric' });
  };
}

/**
 * Format a number according to the current locale.
 */
export function useFormattedNumber() {
  const locale = useLocaleStore((s) => s.locale);
  const localeMap: Record<Locale, string> = { en: 'en-GB', fr: 'fr-FR', pt: 'pt-PT' };

  return function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return value.toLocaleString(localeMap[locale], options);
  };
}
