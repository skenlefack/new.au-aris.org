'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormSchema, FormSection, FormField, FieldCondition } from '../utils/form-schema';
import { FieldRenderer } from './FieldRenderer';
import { evaluateFieldCondition } from './ConditionEvaluator';

/** Context to propagate mobile flag to all nested renderers (repeaters, etc.) */
export const FormMobileContext = createContext(false);
export function useFormMobile() { return useContext(FormMobileContext); }

/* ── Cross-field date validation ─────────────────────────────────────────── */

interface DateChainRule {
  field: string;
  mustBeAfterOrEqual: string;
  message: { en: string; fr: string };
}

const DATE_CHAIN_RULES: DateChainRule[] = [
  {
    field: 'date_reported_vet',
    mustBeAfterOrEqual: 'date_start_outbreak',
    message: {
      en: 'Must be on or after Date of Start of Outbreak',
      fr: 'Doit être égale ou postérieure à la Date de Début du Foyer',
    },
  },
  {
    field: 'date_investigated',
    mustBeAfterOrEqual: 'date_reported_vet',
    message: {
      en: 'Must be on or after Date Reported to Veterinarian',
      fr: 'Doit être égale ou postérieure à la Date de Signalement au Vétérinaire',
    },
  },
  {
    field: 'date_final_diagnosis',
    mustBeAfterOrEqual: 'date_investigated',
    message: {
      en: 'Must be on or after Date Investigated',
      fr: 'Doit être égale ou postérieure à la Date d\'Investigation',
    },
  },
];

function validateDates(values: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const rule of DATE_CHAIN_RULES) {
    const val = values[rule.field];
    const ref = values[rule.mustBeAfterOrEqual];
    if (typeof val !== 'string' || !val || typeof ref !== 'string' || !ref) continue;
    if (val < ref) {
      errors[rule.field] = rule.message.en;
    }
  }
  return errors;
}

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
  onSubmit?: (data: Record<string, unknown>) => void;
}

export function FormRenderer({ schema, formName, mobile = false, preview = false, onSubmit }: FormRendererProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Cross-field date errors (recomputed on every values change)
  const fieldErrors = useMemo(() => validateDates(values), [values]);

  const handleFieldChange = (fieldCode: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldCode]: value }));
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) return; // prevent submission in preview mode
    onSubmit?.(values);
  };

  return (
    <FormMobileContext.Provider value={mobile}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{formName}</h1>
        </div>

        {schema.sections
          .sort((a, b) => a.order - b.order)
          .map((section) => (
            <SectionRenderer
              key={section.id}
              section={section}
              values={values}
              onChange={handleFieldChange}
              fieldErrors={fieldErrors}
              isCollapsed={collapsedSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
            />
          ))}

        {preview ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview mode — you can fill in fields to test the form, but data will not be submitted.
          </div>
        ) : onSubmit && (
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Save Draft
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Submit
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
  const sectionName = section.name.en || section.name.fr || 'Section';

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
          {section.description?.en && (
            <p className="text-xs text-gray-500 mt-0.5">{section.description.en}</p>
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
