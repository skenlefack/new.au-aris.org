import { describe, it, expect } from 'vitest';
import { LOCALES, DEFAULT_LOCALE, LOCALE_LABELS, RTL_LOCALES, isRtl } from '../config';
import type { Locale } from '../config';

describe('i18n config', () => {
  it('should have 5 supported locales', () => {
    expect(LOCALES).toEqual(['en', 'fr', 'pt', 'ar', 'es']);
    expect(LOCALES).toHaveLength(5);
  });

  it('should default to English', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('should have labels for all locales', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_LABELS[locale]).toBeDefined();
      expect(LOCALE_LABELS[locale].label).toBeTruthy();
      expect(LOCALE_LABELS[locale].dir).toMatch(/^(ltr|rtl)$/);
    }
  });

  it('should mark Arabic as RTL', () => {
    expect(LOCALE_LABELS['ar'].dir).toBe('rtl');
    expect(LOCALE_LABELS['en'].dir).toBe('ltr');
    expect(LOCALE_LABELS['fr'].dir).toBe('ltr');
    expect(RTL_LOCALES).toEqual(['ar']);
  });

  it('should detect RTL correctly via isRtl()', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('en')).toBe(false);
    expect(isRtl('fr')).toBe(false);
    expect(isRtl('pt')).toBe(false);
    expect(isRtl('es')).toBe(false);
  });
});
