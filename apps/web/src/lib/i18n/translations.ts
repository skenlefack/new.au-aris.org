'use client';

import { useLocaleStore } from '@/lib/stores/locale-store';
import { useI18nOverridesStore } from '@/lib/stores/i18n-overrides-store';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import pt from '@/messages/pt.json';
import ar from '@/messages/ar.json';
import es from '@/messages/es.json';
import sw from '@/messages/sw.json';
import type { Locale } from './config';

const messages: Record<Locale, Record<string, any>> = { en, fr, pt, ar, es, sw };

/** Resolve a dot-separated key path in an object, e.g. "designer.title" */
function resolve(obj: any, path: string): string | undefined {
  if (!obj) return undefined;
  // Fast path: direct key match (flat structure)
  if (typeof obj[path] === 'string') return obj[path];
  // Dot-notation: walk nested objects
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/**
 * Hook that returns translation function for a namespace.
 * Merges runtime overrides from the backend (SystemConfig i18n-overrides)
 * on top of static JSON files — overrides take priority.
 * Supports dot-notation keys for nested objects (e.g. "designer.title").
 *
 * Usage: const t = useTranslations('dashboard');
 *        t('title') -> 'Dashboard'
 *        t('designer.title') -> 'Workflow Designer'
 */
export function useTranslations(namespace: string) {
  const locale = useLocaleStore((s) => s.locale);
  const overrides = useI18nOverridesStore((s) => s.overrides);
  const ns = messages[locale]?.[namespace] ?? messages.en[namespace] ?? {};
  const enNs = messages.en[namespace] ?? {};

  return function t(key: string, params?: Record<string, string | number>): string {
    // Check runtime overrides first (full key = "namespace.key")
    const fullKey = `${namespace}.${key}`;
    const override = overrides[fullKey]?.[locale];
    let value = override ?? resolve(ns, key) ?? resolve(enNs, key) ?? key;
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
  const localeMap: Record<Locale, string> = { en: 'en-GB', fr: 'fr-FR', pt: 'pt-PT', ar: 'ar-SA', es: 'es-ES', sw: 'sw-KE' };

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
  const localeMap: Record<Locale, string> = { en: 'en-GB', fr: 'fr-FR', pt: 'pt-PT', ar: 'ar-SA', es: 'es-ES', sw: 'sw-KE' };

  return function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return value.toLocaleString(localeMap[locale], options);
  };
}
