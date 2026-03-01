export const LOCALES = ['en', 'fr', 'pt', 'ar', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, { label: string; flag: string; dir: 'ltr' | 'rtl' }> = {
  en: { label: 'English', flag: '\u{1F1EC}\u{1F1E7}', dir: 'ltr' },
  fr: { label: 'Fran\u00E7ais', flag: '\u{1F1EB}\u{1F1F7}', dir: 'ltr' },
  pt: { label: 'Portugu\u00EAs', flag: '\u{1F1F5}\u{1F1F9}', dir: 'ltr' },
  ar: { label: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629', flag: '\u{1F1F8}\u{1F1E6}', dir: 'rtl' },
  es: { label: 'Espa\u00F1ol', flag: '\u{1F1EA}\u{1F1F8}', dir: 'ltr' },
};

export const RTL_LOCALES: Locale[] = ['ar'];

/** Check if a locale uses right-to-left direction */
export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}
