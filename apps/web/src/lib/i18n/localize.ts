import type { Locale } from './config';

/**
 * Get a localized field from a config object that has `field`, `fieldFr`, `fieldPt` pattern.
 * Falls back to English if the requested locale is not available.
 */
export function getLocalizedField<T extends Record<string, any>>(
  obj: T,
  field: string,
  locale: Locale,
): string {
  if (locale === 'fr') {
    const frKey = `${field}Fr`;
    if (frKey in obj && obj[frKey]) return obj[frKey];
  }
  if (locale === 'pt') {
    const ptKey = `${field}Pt`;
    if (ptKey in obj && obj[ptKey]) return obj[ptKey];
  }
  // Default: English (or ar/es fall back to English for now)
  return obj[field] ?? '';
}
