'use client';

import React, { useState, useCallback } from 'react';
import { Languages, Loader2, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslateToAll } from '@/lib/api/translation-hooks';
import { useLocaleStore } from '@/lib/stores/locale-store';

const ALL_LANGS = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
] as const;

interface TranslatableTextFieldProps {
  value: unknown;
  onChange: (value: unknown) => void;
  placeholder?: string;
  readOnly?: boolean;
  multiline?: boolean;
  rows?: number;
  className?: string;
}

/**
 * TranslatableTextField — wraps a text/textarea input with a "Translate" button.
 *
 * When the user types in their language and clicks Translate, SYSTRAN translates
 * the text to all other languages and stores the result as a multilingual object:
 * { en: "...", fr: "...", pt: "...", ar: "..." }
 *
 * The value can be:
 * - A simple string (legacy/single-language) → displayed as-is
 * - A multilingual object { en, fr, pt, ar } → displayed in current locale
 *
 * Backward compatible: if the user never clicks Translate, the value stays a string.
 */
export function TranslatableTextField({
  value,
  onChange,
  placeholder,
  readOnly,
  multiline,
  rows = 4,
  className,
}: TranslatableTextFieldProps) {
  const locale = useLocaleStore((s) => s.locale);
  const currentLang = locale?.slice(0, 2) || 'en';
  const translateMut = useTranslateToAll();
  const [showTranslations, setShowTranslations] = useState(false);

  // Resolve current display value
  const isMultilingual = value !== null && typeof value === 'object' && !Array.isArray(value);
  const mlValue = isMultilingual ? (value as Record<string, string>) : {};
  const displayValue = isMultilingual
    ? (mlValue[currentLang] || mlValue.en || mlValue.fr || Object.values(mlValue).find(v => v) || '')
    : ((value as string) || '');

  // Count filled translations
  const filledCount = isMultilingual
    ? ALL_LANGS.filter(l => mlValue[l.code]?.trim()).length
    : 0;

  const handleChange = useCallback((newText: string) => {
    if (isMultilingual) {
      // Update current language in the multilingual object
      onChange({ ...mlValue, [currentLang]: newText });
    } else {
      // Keep as simple string until user clicks Translate
      onChange(newText);
    }
  }, [isMultilingual, mlValue, currentLang, onChange]);

  const handleTranslate = useCallback(async () => {
    const sourceText = isMultilingual ? (mlValue[currentLang] || '').trim() : (displayValue || '').trim();
    if (!sourceText) return;

    const targets = ALL_LANGS
      .map(l => l.code)
      .filter(code => code !== currentLang);

    try {
      const results = await translateMut.mutateAsync({
        source: currentLang,
        text: sourceText,
        targets,
      });

      // Convert to multilingual object with all translations
      const newValue: Record<string, string> = {
        ...mlValue,
        [currentLang]: sourceText,
        ...results,
      };
      onChange(newValue);
      setShowTranslations(true);
    } catch {
      // Silently fail
    }
  }, [isMultilingual, mlValue, currentLang, displayValue, translateMut, onChange]);

  const handleLangChange = useCallback((lang: string, text: string) => {
    onChange({ ...mlValue, [lang]: text });
  }, [mlValue, onChange]);

  const inputClass = cn(
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800',
    'placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400',
    'dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500',
    className,
  );

  return (
    <div className="space-y-1.5">
      {/* Main input */}
      <div className="relative">
        {multiline ? (
          <textarea
            value={displayValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            rows={rows}
            dir={currentLang === 'ar' ? 'rtl' : 'ltr'}
            className={cn(inputClass, 'resize-y')}
          />
        ) : (
          <input
            type="text"
            value={displayValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            dir={currentLang === 'ar' ? 'rtl' : 'ltr'}
            className={inputClass}
          />
        )}
      </div>

      {/* Translate button bar */}
      {!readOnly && displayValue.trim() && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTranslate}
            disabled={translateMut.isPending || !displayValue.trim()}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              'bg-gradient-to-r from-blue-500 to-indigo-500 text-white',
              'hover:from-blue-600 hover:to-indigo-600',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'shadow-sm',
            )}
          >
            {translateMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Languages className="h-3.5 w-3.5" />
            )}
            {translateMut.isPending ? 'Translating...' : 'Translate'}
          </button>

          {isMultilingual && filledCount > 0 && (
            <button
              type="button"
              onClick={() => setShowTranslations(!showTranslations)}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <Check className="h-3 w-3 text-green-500" />
              {filledCount}/{ALL_LANGS.length} languages
              {showTranslations ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>
      )}

      {/* Translation preview/edit panel */}
      {showTranslations && isMultilingual && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-2.5 space-y-2 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase text-gray-500 tracking-wide">Translations</span>
          </div>
          {ALL_LANGS.filter(l => l.code !== currentLang).map((l) => (
            <div key={l.code} className="flex items-start gap-2">
              <span className="flex items-center gap-1 text-[11px] font-medium text-gray-500 w-8 pt-1.5 shrink-0">
                {l.flag}
              </span>
              {multiline ? (
                <textarea
                  value={mlValue[l.code] || ''}
                  onChange={(e) => handleLangChange(l.code, e.target.value)}
                  dir={l.code === 'ar' ? 'rtl' : 'ltr'}
                  rows={2}
                  className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white resize-y"
                  placeholder={`${l.label}...`}
                />
              ) : (
                <input
                  type="text"
                  value={mlValue[l.code] || ''}
                  onChange={(e) => handleLangChange(l.code, e.target.value)}
                  dir={l.code === 'ar' ? 'rtl' : 'ltr'}
                  className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder={`${l.label}...`}
                />
              )}
              {mlValue[l.code]?.trim() ? (
                <Check className="h-3.5 w-3.5 text-green-500 mt-1.5 shrink-0" />
              ) : (
                <span className="h-3.5 w-3.5 mt-1.5 shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
