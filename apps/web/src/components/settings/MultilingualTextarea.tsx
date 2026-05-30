'use client';

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Wand2 } from 'lucide-react';
import { useTranslateToAll } from '@/lib/api/translation-hooks';

type LangCode = 'en' | 'fr' | 'pt' | 'ar';

interface MultilingualValue {
  [key: string]: string;
}

interface MultilingualTextareaProps {
  label: string;
  value: MultilingualValue;
  onChange: (value: MultilingualValue) => void;
  required?: boolean;
  languages?: LangCode[];
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
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

export function MultilingualTextarea({
  label,
  value,
  onChange,
  required = false,
  languages = ['en', 'fr', 'pt', 'ar'],
  placeholder,
  disabled = false,
  rows = 3,
  error,
}: MultilingualTextareaProps) {
  const [activeLang, setActiveLang] = useState<LangCode>(languages[0]);
  const translateMut = useTranslateToAll();
  const translatingRef = useRef(false);
  const lastTranslatedRef = useRef('');

  const handleChange = (lang: LangCode, text: string) => {
    onChange({ ...value, [lang]: text });
  };

  // Auto-detect source: find first language with text
  const sourceLang = languages.find((l) => value[l]?.trim()) || activeLang;
  const sourceText = value[sourceLang]?.trim() || '';
  const emptyLangs = languages.filter((l) => l !== sourceLang && !value[l]?.trim());

  const handleAutoTranslate = async () => {
    if (!sourceText || emptyLangs.length === 0 || translatingRef.current) return;
    if (sourceText === lastTranslatedRef.current) return;

    translatingRef.current = true;
    try {
      const results = await translateMut.mutateAsync({
        source: sourceLang,
        text: sourceText,
        targets: emptyLangs,
      });
      onChange({ ...value, ...results });
      lastTranslatedRef.current = sourceText;
    } catch {
      // Silently fail
    } finally {
      translatingRef.current = false;
    }
  };

  // Auto-translate on blur
  const handleBlur = () => {
    if (sourceText && emptyLangs.length > 0 && sourceText !== lastTranslatedRef.current) {
      handleAutoTranslate();
    }
  };

  const hasTextToTranslate = !!sourceText;
  const hasEmptyLangs = emptyLangs.length > 0;
  const showAutoTranslate = hasTextToTranslate && hasEmptyLangs && !disabled;

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      {/* Language tabs */}
      <div className="flex items-center gap-1 rounded-t-lg border border-b-0 border-gray-200 bg-gray-50 px-2 pt-2 dark:border-gray-700 dark:bg-gray-800/50">
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
              />
            </button>
          );
        })}

        {/* Auto-translate button */}
        {showAutoTranslate && (
          <button
            type="button"
            onClick={handleAutoTranslate}
            disabled={translateMut.isPending}
            className="ml-auto mb-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-aris-primary-600 hover:bg-aris-primary-50 disabled:opacity-50 dark:text-aris-primary-400 dark:hover:bg-aris-primary-900/20"
            title="Auto-translate to other languages"
          >
            {translateMut.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            Auto
          </button>
        )}
      </div>

      <textarea
        value={value[activeLang] ?? ''}
        onChange={(e) => handleChange(activeLang, e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder ?? `Enter ${LANG_NAMES[activeLang]} translation...`}
        disabled={disabled}
        rows={rows}
        dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
        className={cn(
          'w-full resize-y rounded-b-lg rounded-t-none border border-gray-200 px-3 py-2 text-sm shadow-sm transition-colors',
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
