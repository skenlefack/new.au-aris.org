'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormField, MultilingualText } from '../utils/form-schema';
import { FieldRenderer } from './FieldRenderer';
import { useFormMobile } from './FormRenderer';

/* ── Cross-field validation rules for epidemiological data ────────────── */

interface CrossFieldRule {
  field: string;
  /** Field code whose value must be ≥ this field's value */
  mustBeLte: string;
  message: { en: string; fr: string };
}

/**
 * Epidemiological number constraints:
 * susceptible ≥ at_risk ≥ cases ≥ deaths
 * cases ≥ slaughtered, cases ≥ destroyed
 * susceptible ≥ vaccinated
 */
const EPI_RULES: CrossFieldRule[] = [
  {
    field: 'num_at_risk',
    mustBeLte: 'num_susceptible',
    message: {
      en: 'Cannot exceed Number Susceptible',
      fr: 'Ne peut pas dépasser le Nombre Susceptible',
    },
  },
  {
    field: 'num_cases',
    mustBeLte: 'num_at_risk',
    message: {
      en: 'Cannot exceed Number at Risk',
      fr: 'Ne peut pas dépasser le Nombre à Risque',
    },
  },
  {
    field: 'num_deaths',
    mustBeLte: 'num_cases',
    message: {
      en: 'Cannot exceed Number of Cases',
      fr: 'Ne peut pas dépasser le Nombre de Cas',
    },
  },
  {
    field: 'num_slaughtered',
    mustBeLte: 'num_cases',
    message: {
      en: 'Cannot exceed Number of Cases',
      fr: 'Ne peut pas dépasser le Nombre de Cas',
    },
  },
  {
    field: 'num_destroyed',
    mustBeLte: 'num_cases',
    message: {
      en: 'Cannot exceed Number of Cases',
      fr: 'Ne peut pas dépasser le Nombre de Cas',
    },
  },
];

/**
 * Validate a row against cross-field rules.
 * Returns a map of fieldCode → error message (only for violated rules).
 */
function validateRow(
  row: Record<string, unknown>,
  fieldCodes: Set<string>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const rule of EPI_RULES) {
    // Only apply rules if both fields exist in the repeater
    if (!fieldCodes.has(rule.field)) continue;

    const val = toNum(row[rule.field]);
    if (val === null) continue; // Skip empty values

    // Find the upper-bound reference value
    let upperField = rule.mustBeLte;
    let upperVal = fieldCodes.has(upperField) ? toNum(row[upperField]) : null;

    // Fallback: if num_cases rule references num_at_risk but it doesn't exist,
    // fall back to num_susceptible
    if (upperVal === null && upperField === 'num_at_risk' && fieldCodes.has('num_susceptible')) {
      upperField = 'num_susceptible';
      upperVal = toNum(row['num_susceptible']);
    }

    if (upperVal === null) continue; // Can't validate without reference value

    if (val > upperVal) {
      errors[rule.field] = rule.message.en; // TODO: use i18n locale
    }
  }

  return errors;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Detect comment/observation textarea fields */
function isCommentSubField(field: FormField): boolean {
  if (field.type !== 'textarea') return false;
  const code = field.code.toLowerCase();
  return code.includes('comment') || code.includes('observation') || code.includes('remarks') || code.includes('remark');
}

interface RepeaterFieldProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
}

const ml = (text?: MultilingualText) => text?.en || text?.fr || '';

/**
 * Normalize sub-field data from the seed (which may be simplified)
 * into a full FormField shape that FieldRenderer can consume.
 */
function normalizeSubField(raw: Record<string, unknown>, index: number): FormField {
  return {
    id: (raw.id as string) || `sub-${index}`,
    type: (raw.type as string) || 'text',
    code: (raw.code as string) || `field_${index}`,
    label: (raw.label as MultilingualText) || { en: `Field ${index}` },
    placeholder: (raw.placeholder as MultilingualText) || undefined,
    helpText: (raw.helpText as MultilingualText) || undefined,
    column: (raw.column as number) || 1,
    columnSpan: (raw.columnSpan as number) || 1,
    order: (raw.order as number) ?? index,
    required: (raw.required as boolean) ?? false,
    readOnly: (raw.readOnly as boolean) ?? false,
    hidden: (raw.hidden as boolean) ?? false,
    defaultValue: raw.defaultValue ?? null,
    validation: (raw.validation as FormField['validation']) || {},
    conditions: (raw.conditions as FormField['conditions']) || [],
    properties: (raw.properties as Record<string, unknown>) || {},
  };
}

export function RepeaterField({ field, value, onChange }: RepeaterFieldProps) {
  const mobile = useFormMobile();
  const rawSubFields = (field.properties.fields || []) as Array<Record<string, unknown>>;
  const minRows = (field.properties.minRows as number) || 1;
  const maxRows = (field.properties.maxRows as number) || 10;
  const addLabel = ml(field.properties.addLabel as MultilingualText) || 'Add row';

  // Normalize sub-fields once
  const subFields = useMemo(
    () => rawSubFields.map((sf, i) => normalizeSubField(sf, i)),
    [rawSubFields],
  );

  // Set of sub-field codes (for validation rule matching)
  const fieldCodes = useMemo(
    () => new Set(subFields.map((sf) => sf.code)),
    [subFields],
  );

  // Each row is a Record<string, unknown> keyed by sub-field code
  const rows = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [{}];

  // Per-row validation errors: rowIndex → { fieldCode → errorMessage }
  const [rowErrors, setRowErrors] = useState<Record<number, Record<string, string>>>({});

  const handleRowFieldChange = useCallback(
    (rowIndex: number, fieldCode: string, fieldValue: unknown) => {
      const updated = [...rows];
      updated[rowIndex] = { ...updated[rowIndex], [fieldCode]: fieldValue };
      onChange(updated);

      // Run cross-field validation on this row
      const errors = validateRow(updated[rowIndex], fieldCodes);
      setRowErrors((prev) => {
        const next = { ...prev };
        if (Object.keys(errors).length > 0) {
          next[rowIndex] = errors;
        } else {
          delete next[rowIndex];
        }
        return next;
      });
    },
    [rows, onChange, fieldCodes],
  );

  const addRow = useCallback(() => {
    if (rows.length >= maxRows) return;
    onChange([...rows, {}]);
  }, [rows, maxRows, onChange]);

  const removeRow = useCallback(
    (index: number) => {
      if (rows.length <= minRows) return;
      const updated = rows.filter((_, i) => i !== index);
      onChange(updated.length > 0 ? updated : [{}]);
    },
    [rows, minRows, onChange],
  );

  if (subFields.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <p className="text-xs text-gray-400">No sub-fields configured for this repeater</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              #{rowIndex + 1}
            </span>
            {rows.length > minRows && (
              <button
                type="button"
                onClick={() => removeRow(rowIndex)}
                className="text-red-400 hover:text-red-500 p-0.5"
                title="Remove row"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className={mobile ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}>
            {subFields
              .sort((a, b) => {
                const aC = isCommentSubField(a) ? 1 : 0;
                const bC = isCommentSubField(b) ? 1 : 0;
                if (aC !== bC) return aC - bC;
                return a.order - b.order;
              })
              .map((sf) => (
                <div
                  key={`${rowIndex}-${sf.code}`}
                  className={cn(
                    !mobile && sf.columnSpan === 2 && 'md:col-span-2',
                    !mobile && isCommentSubField(sf) && 'md:col-span-full',
                  )}
                >
                  <FieldRenderer
                    field={sf}
                    value={row[sf.code]}
                    onChange={(v) => handleRowFieldChange(rowIndex, sf.code, v)}
                    error={rowErrors[rowIndex]?.[sf.code]}
                  />
                </div>
              ))}
          </div>
        </div>
      ))}

      {rows.length < maxRows && (
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </button>
      )}
    </div>
  );
}
