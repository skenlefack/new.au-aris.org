'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Globe } from 'lucide-react';

const LOCALES = [
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'fr', label: 'Français', flag: 'FR' },
  { code: 'pt', label: 'Português', flag: 'PT' },
  { code: 'ar', label: 'العربية', flag: 'AR' },
] as const;

const STORAGE_KEY = 'aris-knowledge-locale';

export type KnowledgeLocale = 'en' | 'fr' | 'pt' | 'ar';

/** Read persisted locale from localStorage (SSR-safe). */
function readStored(): KnowledgeLocale {
  if (typeof window === 'undefined') return 'en';
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'fr' || v === 'pt' || v === 'ar') return v;
  return 'en';
}

/** Shared hook — returns [locale, setLocale]. Persists to localStorage. */
export function useKnowledgeLocale(): [KnowledgeLocale, (l: KnowledgeLocale) => void] {
  const [locale, setLocaleState] = useState<KnowledgeLocale>(readStored);

  const setLocale = useCallback((l: KnowledgeLocale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const v = e.newValue as KnowledgeLocale;
        if (['en', 'fr', 'pt', 'ar', 'es', 'sw'].includes(v)) setLocaleState(v);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return [locale, setLocale];
}

/** Floating locale switcher button — fixed top-right or inline. */
export function LocaleSwitcher({
  locale,
  onChange,
  className = '',
}: {
  locale: KnowledgeLocale;
  onChange: (l: KnowledgeLocale) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <div ref={ref} className={'relative ' + className}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        aria-label="Change language"
      >
        <Globe className="h-3.5 w-3.5" />
        {current.flag}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg border bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => { onChange(l.code as KnowledgeLocale); setOpen(false); }}
              className={
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20 ' +
                (locale === l.code ? 'bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300')
              }
            >
              <span className="w-6 text-center text-xs font-bold">{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
