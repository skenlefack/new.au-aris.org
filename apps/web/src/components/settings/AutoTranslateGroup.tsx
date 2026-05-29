'use client';

import React, { useRef } from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import { useTranslateToAll } from '@/lib/api/translation-hooks';

interface LangField {
  lang: string;
  value: string;
  onChange: (value: string) => void;
}

interface AutoTranslateGroupProps {
  /** Label fields for each language, e.g. [{ lang: 'en', value, onChange }, { lang: 'fr', ... }] */
  fields: LangField[];
  /** Children are rendered as-is (the actual input elements) */
  children: React.ReactNode;
}

/**
 * AutoTranslateGroup — wraps a group of per-language input fields
 * with an "Auto-translate" button and onBlur auto-translation.
 *
 * Usage:
 *   <AutoTranslateGroup fields={[
 *     { lang: 'en', value: labelEn, onChange: setLabelEn },
 *     { lang: 'fr', value: labelFr, onChange: setLabelFr },
 *     { lang: 'pt', value: labelPt, onChange: setLabelPt },
 *     { lang: 'ar', value: labelAr, onChange: setLabelAr },
 *   ]}>
 *     <input value={labelEn} onChange={...} onBlur={...} />
 *     <input value={labelFr} onChange={...} onBlur={...} />
 *     ...
 *   </AutoTranslateGroup>
 *
 * Or simpler: just call useAutoTranslateOnBlur() hook in your component.
 */
export function AutoTranslateGroup({ fields, children }: AutoTranslateGroupProps) {
  const translateMut = useTranslateToAll();
  const translatingRef = useRef(false);
  const lastTranslatedRef = useRef('');

  // Find the first field that has text (auto-detect source)
  const sourceField = fields.find(f => f.value?.trim());
  const sourceText = sourceField?.value?.trim() || '';
  const sourceLang = sourceField?.lang || 'en';
  const emptyFields = fields.filter(f => f.lang !== sourceLang && !f.value?.trim());
  const canTranslate = !!sourceText && emptyFields.length > 0;

  const handleTranslate = async () => {
    if (!sourceText || emptyFields.length === 0 || translatingRef.current) return;
    if (sourceText === lastTranslatedRef.current) return;

    translatingRef.current = true;
    try {
      const targets = emptyFields.map(f => f.lang);
      const results = await translateMut.mutateAsync({
        source: sourceLang,
        text: sourceText,
        targets,
      });
      // Apply translations to each empty field
      for (const f of emptyFields) {
        if (results[f.lang]) {
          f.onChange(results[f.lang]);
        }
      }
      lastTranslatedRef.current = sourceText;
    } catch {
      // Silently fail
    } finally {
      translatingRef.current = false;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        {translateMut.isPending && (
          <span className="flex items-center gap-1 text-[10px] text-blue-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Auto-translating...
          </span>
        )}
        {canTranslate && !translateMut.isPending && (
          <button
            type="button"
            onClick={handleTranslate}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium text-aris-primary-600 hover:bg-aris-primary-50 dark:text-aris-primary-400 dark:hover:bg-aris-primary-900/20 transition-colors"
            title="Auto-translate from the filled language to empty ones"
          >
            <Wand2 className="h-3 w-3" />
            Translate all
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Hook for auto-translating per-language fields on blur.
 * Returns a handleBlur function to attach to each input.
 *
 * Usage:
 *   const { handleBlur, isPending } = useAutoTranslateOnBlur(
 *     { en: labelEn, fr: labelFr, pt: labelPt, ar: labelAr },
 *     { en: setLabelEn, fr: setLabelFr, pt: setLabelPt, ar: setLabelAr },
 *   );
 *   <input value={labelEn} onBlur={handleBlur} ... />
 */
export function useAutoTranslateOnBlur(
  values: Record<string, string>,
  setters: Record<string, (v: string) => void>,
) {
  const translateMut = useTranslateToAll();
  const translatingRef = useRef(false);
  const lastTranslatedRef = useRef('');

  const handleBlur = async () => {
    const langs = Object.keys(values);
    const sourceLang = langs.find(l => values[l]?.trim());
    if (!sourceLang) return;

    const sourceText = values[sourceLang]!.trim();
    if (!sourceText || translatingRef.current) return;
    if (sourceText === lastTranslatedRef.current) return;

    const emptyLangs = langs.filter(l => l !== sourceLang && !values[l]?.trim());
    if (emptyLangs.length === 0) return;

    translatingRef.current = true;
    try {
      const results = await translateMut.mutateAsync({
        source: sourceLang,
        text: sourceText,
        targets: emptyLangs,
      });
      for (const lang of emptyLangs) {
        if (results[lang] && setters[lang]) {
          setters[lang](results[lang]);
        }
      }
      lastTranslatedRef.current = sourceText;
    } catch {
      // Silently fail
    } finally {
      translatingRef.current = false;
    }
  };

  return { handleBlur, isPending: translateMut.isPending };
}
