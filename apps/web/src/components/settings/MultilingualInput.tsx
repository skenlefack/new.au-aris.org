'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

type LangCode = 'en' | 'fr' | 'pt' | 'ar' | 'es';

interface MultilingualValue {
  [key: string]: string;
}

interface MultilingualInputProps {
  label: string;
  value: MultilingualValue;
  onChange: (value: MultilingualValue) => void;
  required?: boolean;
  languages?: LangCode[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

const LANG_LABELS: Record<LangCode, string> = {
  en: 'EN',
  fr: 'FR',
  pt: 'PT',
  ar: 'AR',
  es: 'ES',
};

const LANG_NAMES: Record<LangCode, string> = {
  en: 'English',
  fr: 'Fran\u00e7ais',
  pt: 'Portugu\u00eas',
  ar: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',
  es: 'Espa\u00f1ol',
};

export function MultilingualInput({
  label,
  value,
  onChange,
  required = false,
  languages = ['en', 'fr', 'pt', 'ar', 'es'],
  placeholder,
  disabled = false,
  error,
}: MultilingualInputProps) {
  const [activeLang, setActiveLang] = useState<LangCode>(languages[0]);

  const handleChange = (lang: LangCode, text: string) => {
    onChange({ ...value, [lang]: text });
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      {/* Language tabs */}
      <div className="flex gap-1 rounded-t-lg border border-b-0 border-gray-200 bg-gray-50 px-2 pt-2 dark:border-gray-700 dark:bg-gray-800/50">
        {languages.map((lang) => {
          const filled = !!value[lang]?.trim();
          const active = activeLang === lang;
          return (
            <button
              key={lang}
              type="button"
              onClick={() => setActiveLang(lang)}
              className={cn(
                'relative flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-semibold transition-colors',
                active
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              )}
            >
              {LANG_LABELS[lang]}
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  filled ? 'bg-emerald-500' : 'bg-red-400',
                )}
                title={filled ? `${LANG_NAMES[lang]}: filled` : `${LANG_NAMES[lang]}: empty`}
              />
            </button>
          );
        })}
      </div>

      {/* Input field */}
      <input
        type="text"
        value={value[activeLang] ?? ''}
        onChange={(e) => handleChange(activeLang, e.target.value)}
        placeholder={placeholder ?? `Enter ${LANG_NAMES[activeLang]} translation...`}
        disabled={disabled}
        dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
        className={cn(
          'w-full rounded-b-lg rounded-t-none border border-gray-200 px-3 py-2 text-sm shadow-sm transition-colors',
          'focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500',
          'dark:border-gray-700 dark:bg-gray-900 dark:text-white',
          'disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800',
          error && 'border-red-400 focus:border-red-500 focus:ring-red-500',
        )}
      />

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
