'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
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
 * TranslatableTextField — wraps a text/textarea input with auto-translation.
 *
 * Auto-translates on:
 * 1. onBlur — when the user leaves the field, SYSTRAN translates to all other languages
 * 2. Explicit "Translate" button click
 *
 * The value can be:
 * - A simple string (legacy/single-language) → auto-translated on blur → becomes multilingual
 * - A multilingual object { en, fr, pt, ar, es } → displayed in current locale
 *
 * Use `translateBeforeSubmit()` to translate any remaining untranslated fields before form save.
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
  const translatingRef = useRef(false);
  const lastTranslatedRef = useRef('');

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
      onChange({ ...mlValue, [currentLang]: newText });
    } else {
      onChange(newText);
    }
  }, [isMultilingual, mlValue, currentLang, onChange]);

  const doTranslate = useCallback(async () => {
    // Auto-detect source: find the first language that has text
    let sourceLang = currentLang;
    let sourceText = isMultilingual ? (mlValue[currentLang] || '').trim() : (displayValue || '').trim();

    if (!sourceText && isMultilingual) {
      for (const l of ALL_LANGS) {
        if (mlValue[l.code]?.trim()) {
          sourceLang = l.code;
          sourceText = mlValue[l.code]!.trim();
          break;
        }
      }
    }

    if (!sourceText || translatingRef.current) return;
    // Don't re-translate if the text hasn't changed since last translation
    if (sourceText === lastTranslatedRef.current) return;

    const targets = ALL_LANGS
      .map(l => l.code)
      .filter(code => code !== sourceLang && !(isMultilingual && mlValue[code]?.trim()));

    if (targets.length === 0) return;

    translatingRef.current = true;
    try {
      const results = await translateMut.mutateAsync({
        source: sourceLang,
        text: sourceText,
        targets,
      });

      const newValue: Record<string, string> = {
        ...mlValue,
        [sourceLang]: sourceText,
        ...results,
      };
      onChange(newValue);
      lastTranslatedRef.current = sourceText;
      setShowTranslations(true);
    } catch {
      // Silently fail
    } finally {
      translatingRef.current = false;
    }
  }, [isMultilingual, mlValue, currentLang, displayValue, translateMut, onChange]);

  // Auto-translate on blur
  const handleBlur = useCallback(() => {
    const text = isMultilingual ? (mlValue[currentLang] || '').trim() : (displayValue || '').trim();
    if (text && text !== lastTranslatedRef.current) {
      doTranslate();
    }
  }, [isMultilingual, mlValue, currentLang, displayValue, doTranslate]);

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
            onBlur={handleBlur}
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
            onBlur={handleBlur}
            placeholder={placeholder}
            readOnly={readOnly}
            dir={currentLang === 'ar' ? 'rtl' : 'ltr'}
            className={inputClass}
          />
        )}
        {/* Inline translating indicator */}
        {translateMut.isPending && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-blue-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-[10px] font-medium">Translating...</span>
          </div>
        )}
      </div>

      {/* Status bar: show filled count + manual translate button */}
      {!readOnly && displayValue.trim() && (
        <div className="flex items-center gap-2">
          {!translateMut.isPending && (
            <button
              type="button"
              onClick={doTranslate}
              disabled={translateMut.isPending || !displayValue.trim()}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                'bg-gradient-to-r from-blue-500 to-indigo-500 text-white',
                'hover:from-blue-600 hover:to-indigo-600',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'shadow-sm',
              )}
            >
              <Languages className="h-3.5 w-3.5" />
              Translate
            </button>
          )}

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

/**
 * Utility: translate all untranslated text fields in a form data object before submission.
 * Call this in the form's onSubmit handler before sending data to the API.
 *
 * Usage:
 *   const translatedData = await translateFormBeforeSubmit(formData);
 *   submitMutation.mutate(translatedData);
 */
export async function translateFormBeforeSubmit(
  formData: Record<string, unknown>,
  translateFn: (params: { source: string; text: string; targets: string[] }) => Promise<Record<string, string>>,
): Promise<Record<string, unknown>> {
  const result = { ...formData };
  const langCodes = ALL_LANGS.map(l => l.code);

  for (const [key, value] of Object.entries(result)) {
    // Skip non-string/non-object values
    if (!value) continue;

    if (typeof value === 'string' && value.trim()) {
      // Simple string — translate to all languages
      try {
        const translations = await translateFn({
          source: 'en', // auto-detected by the proxy
          text: value.trim(),
          targets: langCodes,
        });
        result[key] = { ...translations };
      } catch {
        // Keep as simple string if translation fails
      }
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Multilingual object — translate any empty languages
      const mlObj = value as Record<string, string>;
      const sourceLang = langCodes.find(l => mlObj[l]?.trim());
      if (!sourceLang) continue;

      const sourceText = mlObj[sourceLang]!.trim();
      const emptyLangs = langCodes.filter(l => l !== sourceLang && !mlObj[l]?.trim());
      if (emptyLangs.length === 0) continue;

      try {
        const translations = await translateFn({
          source: sourceLang,
          text: sourceText,
          targets: emptyLangs,
        });
        result[key] = { ...mlObj, ...translations };
      } catch {
        // Keep existing values
      }
    }
  }

  return result;
}
