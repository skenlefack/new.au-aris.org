'use client';

import { create } from 'zustand';

/**
 * Store for i18n translation overrides loaded from the backend (SystemConfig).
 * Overrides are keyed by full dotted path (e.g. "settings.translationsTitle")
 * and values are per-language maps (e.g. { fr: "Traductions", en: "Translations" }).
 */
interface I18nOverridesState {
  /** { "namespace.key": { lang: "value" } } */
  overrides: Record<string, Record<string, string>>;
  /** Whether overrides have been loaded at least once */
  loaded: boolean;
  setOverrides: (overrides: Record<string, Record<string, string>>) => void;
}

export const useI18nOverridesStore = create<I18nOverridesState>((set) => ({
  overrides: {},
  loaded: false,
  setOverrides: (overrides) => set({ overrides, loaded: true }),
}));
