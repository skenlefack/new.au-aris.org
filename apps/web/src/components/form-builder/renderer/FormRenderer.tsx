'use client';

import React, { createContext, useContext, useMemo, useState, useRef } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormSchema, FormSection, FormField, FieldCondition } from '../utils/form-schema';
import { FieldRenderer } from './FieldRenderer';
import { evaluateFieldCondition, evaluateCrossFieldRules } from './ConditionEvaluator';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useTranslateToAll } from '@/lib/api/translation-hooks';

/** Context to propagate mobile flag to all nested renderers (repeaters, etc.) */
export const FormMobileContext = createContext(false);
export function useFormMobile() { return useContext(FormMobileContext); }

/** Detect comment/observation textarea fields that should span full width and appear last */
function isCommentField(field: FormField): boolean {
  if (field.type !== 'textarea') return false;
  const code = field.code.toLowerCase();
  return code.includes('comment') || code.includes('observation') || code.includes('remarks') || code.includes('remark');
}

interface FormRendererProps {
  schema: FormSchema;
  formName: string;
  /** Force single-column layout (used for mobile preview) */
  mobile?: boolean;
  /** Preview/simulation mode — all fields interactive but submission disabled */
  preview?: boolean;
  /** Whether the form is currently being submitted (disables button, shows spinner) */
  isSubmitting?: boolean;
  onSubmit?: (data: Record<string, unknown>) => void;
  /** Campaign target countries (ISO codes) — filters admin-location fields */
  campaignTargetCountries?: string[];
}

/** Check if a value is considered "empty" for required-field validation */
function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/** Layout/display-only field types that should never be required */
const LAYOUT_TYPES = new Set(['heading', 'divider', 'spacer', 'info-box']);

export function FormRenderer({ schema, formName, mobile = false, preview = false, isSubmitting = false, onSubmit, campaignTargetCountries }: FormRendererProps) {
  const t = useTranslations('collecte');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [requiredErrors, setRequiredErrors] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const locale = useLocaleStore((s) => s.locale);
  const translateMut = useTranslateToAll();

  // Cross-field validation errors (dynamic rules from schema)
  const crossFieldErrors = useMemo(
    () => evaluateCrossFieldRules(schema.validationRules, values, locale),
    [values, schema.validationRules, locale],
  );

  // Merge required-field errors with cross-field errors
  const fieldErrors = useMemo(
    () => ({ ...crossFieldErrors, ...requiredErrors }),
    [crossFieldErrors, requiredErrors],
  );

  const handleFieldChange = (fieldCode: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldCode]: value }));
    // Clear required error when user fills the field
    if (requiredErrors[fieldCode] && !isEmptyValue(value)) {
      setRequiredErrors((prev) => {
        const next = { ...prev };
        delete next[fieldCode];
        return next;
      });
    }
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  /** Translate any untranslated text/textarea fields before submission */
  const translateUntranslatedFields = async (formValues: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const ALL_LANG_CODES = ['en', 'fr', 'pt', 'ar', 'es'];
    const textFields = new Set<string>();

    // Identify text/textarea fields from the schema
    for (const section of schema.sections) {
      for (const field of section.fields) {
        if (field.type === 'text' || field.type === 'textarea') {
          textFields.add(field.code);
        }
      }
    }

    const result = { ...formValues };
    const promises: Promise<void>[] = [];

    for (const code of textFields) {
      const val = result[code];
      if (!val) continue;

      if (typeof val === 'string' && val.trim()) {
        // Simple string — translate to all languages
        promises.push(
          translateMut.mutateAsync({ source: 'en', text: val.trim(), targets: ALL_LANG_CODES })
            .then((translations) => { result[code] = { ...translations }; })
            .catch(() => { /* keep original */ }),
        );
      } else if (typeof val === 'object' && !Array.isArray(val)) {
        // Multilingual object — fill empty languages
        const mlObj = val as Record<string, string>;
        const sourceLang = ALL_LANG_CODES.find(l => mlObj[l]?.trim());
        if (!sourceLang) continue;
        const emptyLangs = ALL_LANG_CODES.filter(l => l !== sourceLang && !mlObj[l]?.trim());
        if (emptyLangs.length === 0) continue;

        promises.push(
          translateMut.mutateAsync({ source: sourceLang, text: mlObj[sourceLang]!.trim(), targets: emptyLangs })
            .then((translations) => { result[code] = { ...mlObj, ...translations }; })
            .catch(() => { /* keep existing */ }),
        );
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview || isSubmitting || isTranslating) return;

    // Validate required fields before submitting
    const errors: Record<string, string> = {};
    for (const section of schema.sections) {
      if (section.conditions?.length) {
        const cond = applyFieldConditions(section.conditions, values);
        if (cond.hidden) continue;
      }
      for (const field of section.fields) {
        if (field.hidden || LAYOUT_TYPES.has(field.type)) continue;
        const condResult = applyFieldConditions(field.conditions, values);
        if (condResult.hidden) continue;
        const isRequired = condResult.required ?? field.required;
        if (isRequired && isEmptyValue(values[field.code])) {
          const lang = locale?.slice(0, 2) ?? 'en';
          const label = field.label?.[lang] || field.label?.en || field.label?.fr || field.code;
          errors[field.code] = `${label} is required`;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setRequiredErrors(errors);
      setCollapsedSections((prev) => {
        const next = new Set(prev);
        for (const section of schema.sections) {
          if (section.fields.some((f) => errors[f.code])) {
            next.delete(section.id);
          }
        }
        return next;
      });
      return;
    }

    setRequiredErrors({});

    // Auto-translate untranslated text fields before submitting
    setIsTranslating(true);
    try {
      const translatedValues = await translateUntranslatedFields(values);
      setValues(translatedValues);
      onSubmit?.(translatedValues);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <FormMobileContext.Provider value={mobile}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{formName}</h1>
        </div>

        {schema.sections
          .sort((a, b) => a.order - b.order)
          .map((section) => {
            // Evaluate section-level conditions
            if (section.conditions && section.conditions.length > 0) {
              const sectionCond = applyFieldConditions(section.conditions, values);
              if (sectionCond.hidden) return null;
            }
            return (
              <SectionRenderer
                key={section.id}
                section={section}
                values={campaignTargetCountries
                  ? { ...values, _campaignTargetCountries: campaignTargetCountries }
                  : values
                }
                onChange={handleFieldChange}
                fieldErrors={fieldErrors}
                isCollapsed={collapsedSections.has(section.id)}
                onToggle={() => toggleSection(section.id)}
              />
            );
          })}

        {/* Validation summary */}
        {Object.keys(requiredErrors).length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            <p className="font-medium">{Object.keys(requiredErrors).length} {t('requiredFieldsError')}</p>
          </div>
        )}

        {preview ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {t('previewModeMessage')}
          </div>
        ) : onSubmit && (
          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting || isTranslating}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(isSubmitting || isTranslating) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {isTranslating ? t('translatingBeforeSubmit') : isSubmitting ? t('submitting') : t('submitForm')}
            </button>
          </div>
        )}
      </form>
    </FormMobileContext.Provider>
  );
}

/* ── Condition evaluation helper ─────────────────────────────────────────── */

interface ConditionResult {
  hidden: boolean;
  readOnly?: boolean;
  required?: boolean;
}

function applyFieldConditions(
  conditions: FieldCondition[] | undefined,
  formValues: Record<string, unknown>,
): ConditionResult {
  const result: ConditionResult = { hidden: false };
  if (!conditions || conditions.length === 0) return result;

  for (const condition of conditions) {
    const met = evaluateFieldCondition(condition, formValues);

    switch (condition.action) {
      case 'show':
        // If condition is NOT met, hide the field
        if (!met) result.hidden = true;
        break;
      case 'hide':
        // If condition IS met, hide the field
        if (met) result.hidden = true;
        break;
      case 'enable':
        // If condition is NOT met, field is readOnly
        result.readOnly = !met;
        break;
      case 'disable':
        // If condition IS met, field is readOnly
        result.readOnly = met;
        break;
      case 'setRequired':
        // If condition is met, field becomes required
        result.required = met;
        break;
    }
  }

  return result;
}

function SectionRenderer({
  section,
  values,
  onChange,
  fieldErrors,
  isCollapsed,
  onToggle,
}: {
  section: FormSection;
  values: Record<string, unknown>;
  onChange: (code: string, value: unknown) => void;
  fieldErrors: Record<string, string>;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const mobile = useFormMobile();
  const locale = useLocaleStore((s) => s.locale);
  const lang = locale?.slice(0, 2) ?? 'en';
  const sectionName = section.name[lang] || section.name.en || section.name.fr || 'Section';
  const sectionDesc = section.description?.[lang] || section.description?.en || '';

  // Build grid classes: always start with grid-cols-1, add responsive only when NOT mobile
  const gridClass = mobile
    ? 'grid gap-4 grid-cols-1'
    : cn(
        'grid gap-4 grid-cols-1',
        section.columns === 2 && 'md:grid-cols-2',
        section.columns === 3 && 'md:grid-cols-3',
        section.columns === 4 && 'md:grid-cols-2 lg:grid-cols-4',
      );

  return (
    <div
      className="rounded-xl border bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700"
      style={section.color ? { borderTopColor: section.color, borderTopWidth: 3 } : undefined}
    >
      {/* Section Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 cursor-pointer select-none"
        onClick={section.isCollapsible ? onToggle : undefined}
      >
        {section.isCollapsible && (
          isCollapsed
            ? <ChevronRight className="h-5 w-5 text-gray-400" />
            : <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{sectionName}</h2>
          {sectionDesc && (
            <p className="text-xs text-gray-500 mt-0.5">{sectionDesc}</p>
          )}
        </div>
      </div>

      {/* Section Fields */}
      {!isCollapsed && (
        <div className="px-6 pb-6">
          <div className={gridClass}>
            {section.fields
              .filter((f) => !f.hidden)
              .sort((a, b) => {
                const aComment = isCommentField(a) ? 1 : 0;
                const bComment = isCommentField(b) ? 1 : 0;
                if (aComment !== bComment) return aComment - bComment;
                return a.order - b.order;
              })
              .map((field) => {
                // Apply field-level conditions
                const condResult = applyFieldConditions(field.conditions, values);
                if (condResult.hidden) return null;

                const effectiveField = {
                  ...field,
                  readOnly: condResult.readOnly ?? field.readOnly,
                  required: condResult.required ?? field.required,
                };

                return (
                  <div
                    key={field.id}
                    className={cn(
                      !mobile && field.columnSpan === 2 && 'md:col-span-2',
                      !mobile && field.columnSpan === 3 && 'md:col-span-3',
                      !mobile && field.columnSpan === 4 && 'md:col-span-4',
                      !mobile && isCommentField(field) && 'md:col-span-full',
                    )}
                  >
                    <FieldRenderer
                      field={effectiveField}
                      value={values[field.code]}
                      onChange={(v) => onChange(field.code, v)}
                      error={fieldErrors[field.code]}
                      formValues={values}
                    />
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
