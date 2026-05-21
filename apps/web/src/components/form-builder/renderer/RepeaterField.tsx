'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
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
  /** Parent form values — passed through to sub-fields for dynamic parentFilter resolution */
  formValues?: Record<string, unknown>;
}

import { useLocaleStore } from '@/lib/stores/locale-store';

function useML() {
  const locale = useLocaleStore((s) => s.locale);
  const lang = locale?.slice(0, 2) ?? 'en';
  return (text?: MultilingualText) => {
    if (!text) return '';
    return text[lang] || text.en || text.fr || text.pt || Object.values(text).find((v) => v) || '';
  };
}

/**
 * Normalize sub-field data from the seed (which may be simplified)
 * into a full FormField shape that FieldRenderer can consume.
 */
function normalizeSubField(raw: Record<string, unknown>, index: number): FormField {
  // Options can be at root level (from seed) or inside properties
  const props = (raw.properties as Record<string, unknown>) || {};
  if (raw.options && !props.options) {
    props.options = raw.options;
  }
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
    properties: props,
  };
}

export function RepeaterField({ field, value, onChange, formValues }: RepeaterFieldProps) {
  const t = useTranslations('collecte');
  const ml = useML();
  const mobile = useFormMobile();
  const rawSubFields = (field.properties.fields || []) as Array<Record<string, unknown>>;
  const minRows = (field.properties.minRows as number) || 1;
  const maxRows = (field.properties.maxRows as number) || 10;
  const addLabel = ml(field.properties.addLabel as MultilingualText) || t('fbAddRow');

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
    const newRow: Record<string, unknown> = {};
    // Auto-fill sample_code for the new row
    if (hasSampleCode) {
      newRow.sample_code = computeSampleCode(rows.length);
    }
    onChange([...rows, newRow]);
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
        <p className="text-xs text-gray-400">{t('fbNoSubFieldsRepeater')}</p>
      </div>
    );
  }

  // Auto-compute sample_code from admin_location if present
  const hasSampleCode = subFields.some((sf) => sf.code === 'sample_code');
  const adminLoc = formValues?.admin_location as Record<string, string> | undefined;
  const computeSampleCode = useCallback((rowIndex: number): string => {
    if (!adminLoc) return `${rowIndex + 1}`;
    const parts = [
      adminLoc.level_1 || '',
      adminLoc.level_2 || '',
      adminLoc.level_4 || adminLoc.level_3 || '',
    ].filter(Boolean);
    // Use short codes (last segment after / or -)
    const short = parts.map((p) => {
      const s = p.split(/[/.\-_]/).pop() || p;
      return s.length > 6 ? s.slice(0, 6) : s;
    });
    return [...short, String(rowIndex + 1)].join('/');
  }, [adminLoc]);

  // Table layout: when all sub-fields are simple types (select/text/number/checkbox)
  // and there are ≤ 8 fields and NOT mobile → render as horizontal table
  const SIMPLE_TYPES = new Set(['text', 'number', 'select', 'checkbox', 'date']);
  const useTableLayout = !mobile && subFields.length <= 8 && subFields.every((sf) => SIMPLE_TYPES.has(sf.type));

  if (useTableLayout) {
    const sorted = [...subFields].sort((a, b) => a.order - b.order);
    return (
      <div className="space-y-2">
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase w-10">#</th>
                {sorted.map((sf) => (
                  <th key={sf.code} className="px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">
                    {ml(sf.label)}
                    {sf.required && <span className="text-red-500 ml-0.5">*</span>}
                  </th>
                ))}
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                  <td className="px-2 py-1.5 text-center text-xs font-mono text-gray-400">{ri + 1}</td>
                  {sorted.map((sf) => {
                    // Auto-compute sample_code
                    const isAutoCode = hasSampleCode && sf.code === 'sample_code';
                    const autoValue = isAutoCode ? computeSampleCode(ri) : undefined;

                    return (
                    <td key={`${ri}-${sf.code}`} className="px-1 py-1">
                      {isAutoCode ? (
                        <span className="inline-block w-full min-w-[80px] rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-xs font-mono text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                          {autoValue}
                        </span>
                      ) : sf.type === 'select' ? (
                        <select
                          value={(row[sf.code] as string) || ''}
                          onChange={(e) => handleRowFieldChange(ri, sf.code, e.target.value || null)}
                          className="w-full min-w-[80px] rounded border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                        >
                          <option value="">—</option>
                          {((sf.properties?.options || []) as Array<{ label?: MultilingualText; value: string }>).map((opt) => (
                            <option key={opt.value} value={opt.value}>{ml(opt.label)}</option>
                          ))}
                        </select>
                      ) : sf.type === 'checkbox' ? (
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={!!row[sf.code]}
                            onChange={(e) => handleRowFieldChange(ri, sf.code, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          />
                        </div>
                      ) : sf.type === 'number' ? (
                        <input
                          type="number"
                          value={row[sf.code] !== undefined && row[sf.code] !== null ? String(row[sf.code]) : ''}
                          onChange={(e) => handleRowFieldChange(ri, sf.code, e.target.value ? Number(e.target.value) : null)}
                          placeholder={ml(sf.placeholder)}
                          className="w-full min-w-[60px] rounded border border-gray-200 px-2 py-1.5 text-xs text-right dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                        />
                      ) : (
                        <input
                          type="text"
                          value={(row[sf.code] as string) || ''}
                          onChange={(e) => handleRowFieldChange(ri, sf.code, e.target.value)}
                          placeholder={ml(sf.placeholder)}
                          className="w-full min-w-[80px] rounded border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                        />
                      )}
                      {rowErrors[ri]?.[sf.code] && (
                        <p className="text-[9px] text-red-500 mt-0.5">{rowErrors[ri][sf.code]}</p>
                      )}
                    </td>
                    );
                  })}
                  <td className="px-1 py-1.5">
                    {rows.length > minRows && (
                      <button type="button" onClick={() => removeRow(ri)}
                        className="rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length < maxRows && (
          <button type="button" onClick={addRow}
            className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 font-medium">
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </button>
        )}
      </div>
    );
  }

  // Card layout (default): each row as a card with sub-fields in 2-column grid
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
                title={t('fbRemoveRow')}
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
                    formValues={{ ...formValues, ...row }}
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
