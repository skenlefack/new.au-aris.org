'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Languages, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/config';

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const currentLabel = LOCALE_LABELS[locale];

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    },
    [open],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  function handleSelect(selectedLocale: Locale) {
    setLocale(selectedLocale);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Language: ${currentLabel.label}`}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-sm',
          'hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800',
          'transition-all duration-150',
          open && 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800',
        )}
      >
        <Languages className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <span className="hidden sm:inline">{currentLabel.flag}</span>
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {locale.toUpperCase()}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select language"
          className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-1 shadow-xl animate-scale-in"
        >
          {LOCALES.map((loc) => {
            const info = LOCALE_LABELS[loc];
            const isSelected = loc === locale;

            return (
              <button
                key={loc}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(loc)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors duration-100',
                  'hover:bg-gray-50 dark:hover:bg-gray-800',
                  isSelected && 'bg-[var(--color-accent-light)] font-medium',
                )}
                style={isSelected ? { color: 'var(--color-accent)' } : undefined}
              >
                <span className="text-base">{info.flag}</span>
                <span className="text-gray-700 dark:text-gray-300">{info.label}</span>
                {info.dir === 'rtl' && (
                  <span className="ml-auto rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[9px] font-medium text-gray-400">
                    RTL
                  </span>
                )}
                {isSelected && (
                  <Check className="ml-auto h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
