'use client';

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Wand2 } from 'lucide-react';
import { useTranslateToAll } from '@/lib/api/translation-hooks';
import { useLocaleStore } from '@/lib/stores/locale-store';

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
  error?: string;
  rows?: number;
}

const LANG_LABELS: Record<LangCode, string> = { en: 'EN', fr: 'FR', pt: 'PT', ar: 'AR', es: 'ES' };
const LANG_NAMES: Record<LangCode, string> = { en: 'English', fr: 'Français', pt: 'Português', ar: 'العربية', es: 'Español' };

export function MultilingualTextarea({
  label,
  value,
  onChange,
  required = false,
  languages = ['en', 'fr', 'pt', 'ar'],
  placeholder,
  disabled = false,
  error,
  rows = 3,
}: MultilingualTextareaProps) {
  const locale = useLocaleStore((s) => s.locale);
  const userLang = (locale?.slice(0, 2) || 'en') as LangCode;
  const defaultLang = languages.includes(userLang) ? userLang : languages[0];
  const [activeLang, setActiveLang] = useState<LangCode>(defaultLang);
  const translateMut = useTranslateToAll();
  const translatingRef = useRef(false);
  const lastTranslatedRef = useRef('');

  const sourceLang = languages.find((l) => value[l]?.trim()) || activeLang;
  const sourceText = value[sourceLang]?.trim() || '';
  const otherLangs = languages.filter((l) => l !== sourceLang);
  const emptyLangs = otherLangs.filter((l) => !value[l]?.trim());

  const handleAutoTranslate = async (forceAll = false) => {
    const targets = forceAll ? otherLangs : emptyLangs;
    if (!sourceText || targets.length === 0 || translatingRef.current) return;

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

  const handleBlur = () => {
    if (sourceText && emptyLangs.length > 0 && sourceText !== lastTranslatedRef.current) {
      handleAutoTranslate();
    }
  };

  const showAutoTranslate = !!sourceText && otherLangs.length > 0 && !disabled;

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      <div className="flex items-center gap-1 rounded-t-lg border border-b-0 border-gray-200 bg-gray-50 px-2 pt-2 dark:border-gray-700 dark:bg-gray-800/50">
        {languages.map((lang) => {
          const filled = !!value[lang]?.trim();
          return (
            <button
              key={lang}
              type="button"
              onClick={() => setActiveLang(lang)}
              className={cn(
                'relative flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-semibold transition-colors',
                activeLang === lang
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
              )}
            >
              {LANG_LABELS[lang]}
              <span className={cn('h-1.5 w-1.5 rounded-full', filled ? 'bg-emerald-500' : 'bg-red-400')} />
            </button>
          );
        })}

        {showAutoTranslate && (
          <button
            type="button"
            onClick={() => handleAutoTranslate(emptyLangs.length === 0)}
            disabled={translateMut.isPending}
            className="ml-auto mb-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-aris-primary-600 hover:bg-aris-primary-50 disabled:opacity-50 dark:text-aris-primary-400 dark:hover:bg-aris-primary-900/20"
            title="Auto-translate to other languages"
          >
            {translateMut.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            {emptyLangs.length > 0 ? 'Auto' : 'Re-translate'}
          </button>
        )}
      </div>

      <textarea
        value={value[activeLang] ?? ''}
        onChange={(e) => onChange({ ...value, [activeLang]: e.target.value })}
        onBlur={handleBlur}
        placeholder={placeholder ?? `Enter ${LANG_NAMES[activeLang]} translation...`}
        disabled={disabled}
        dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
        rows={rows}
        className={cn(
          'w-full rounded-b-lg rounded-t-none border border-gray-200 px-3 py-2 text-sm shadow-sm transition-colors',
          'focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500',
          'dark:border-gray-700 dark:bg-gray-900 dark:text-white',
          'disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800',
          error && 'border-red-400',
        )}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
