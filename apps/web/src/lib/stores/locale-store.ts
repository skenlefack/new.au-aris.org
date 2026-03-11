'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale } from '@/lib/i18n/config';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  _hasHydrated: boolean;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale) => set({ locale }),
      _hasHydrated: false,
    }),
    {
      name: 'aris-locale',
      onRehydrateStorage: () => () => {
        useLocaleStore.setState({ _hasHydrated: true });
      },
    },
  ),
);
