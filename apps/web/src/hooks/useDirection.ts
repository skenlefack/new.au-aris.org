'use client';

import { useEffect } from 'react';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { isRtl } from '@/lib/i18n/config';

/**
 * Sets dir="rtl" on <html> when locale is Arabic.
 * Call once in the root layout or providers.
 */
export function useDirection() {
  const locale = useLocaleStore((s) => s.locale);

  useEffect(() => {
    const html = document.documentElement;
    const dir = isRtl(locale) ? 'rtl' : 'ltr';
    html.setAttribute('dir', dir);
    html.setAttribute('lang', locale);
  }, [locale]);
}
