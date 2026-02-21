export const LOCALES = ['en', 'fr', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, { label: string; flag: string; dir: 'ltr' | 'rtl' }> = {
  en: { label: 'English', flag: '\u{1F1EC}\u{1F1E7}', dir: 'ltr' },
  fr: { label: 'Fran\u00E7ais', flag: '\u{1F1EB}\u{1F1F7}', dir: 'ltr' },
  pt: { label: 'Portugu\u00EAs', flag: '\u{1F1F5}\u{1F1F9}', dir: 'ltr' },
};

// RTL placeholder for future Arabic support
export const RTL_LOCALES: Locale[] = [];
