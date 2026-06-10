'use client';

import React, { useMemo } from 'react';
import { usePaidReferentials, type PaidReferentialItem } from '@/lib/api/ref-data-hooks';
import { cn } from '@/lib/utils';

interface DynamicBreakdownFieldProps {
  /** Current value — JSON object keyed by field_code */
  value: Record<string, unknown> | null;
  /** Callback when any breakdown field changes */
  onChange: (value: Record<string, unknown>) => void;
  /** The PAID activity code to fetch breakdown fields for */
  paidActivityCode?: string;
  /** Whether the form is read-only */
  readOnly?: boolean;
  className?: string;
}

/**
 * Renders dynamic breakdown fields configured per PAID activity.
 * Fetches field definitions from GET /api/v1/master-data/paid/breakdown-fields?paid_activity=CODE
 * and renders the configured fields (number, text, textarea, select, date, etc.)
 */
export function DynamicBreakdownField({
  value,
  onChange,
  paidActivityCode,
  readOnly = false,
  className,
}: DynamicBreakdownFieldProps) {
  const { data, isLoading } = usePaidReferentials('PAID_BREAKDOWN_FIELD', {
    paid_activity: paidActivityCode,
  });

  const fields = useMemo(() => {
    const items = data?.data ?? [];
    return items
      .filter((f: PaidReferentialItem) => f.field_code && f.field_label)
      .sort((a: PaidReferentialItem, b: PaidReferentialItem) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [data]);

  if (!paidActivityCode || fields.length === 0) return null;

  if (isLoading) {
    return (
      <div className={cn('space-y-2 rounded-lg border border-dashed border-gray-200 p-4 dark:border-gray-700', className)}>
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-9 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  const currentValue = value ?? {};

  const handleFieldChange = (fieldCode: string, fieldValue: unknown) => {
    onChange({ ...currentValue, [fieldCode]: fieldValue });
  };

  return (
    <div className={cn('space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800/50 dark:bg-amber-900/10', className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
        Break Down
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field: PaidReferentialItem) => {
          const code = field.field_code!;
          const label = field.field_label!;
          const type = field.field_type ?? 'text';
          const required = field.is_required ?? false;
          const val = currentValue[code] ?? '';

          return (
            <div key={code}>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                {label}
                {required && <span className="ml-0.5 text-red-500">*</span>}
              </label>

              {type === 'number' && (
                <input
                  type="number"
                  value={val as string}
                  onChange={(e) => handleFieldChange(code, e.target.value ? Number(e.target.value) : '')}
                  readOnly={readOnly}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              )}

              {type === 'text' && (
                <input
                  type="text"
                  value={val as string}
                  onChange={(e) => handleFieldChange(code, e.target.value)}
                  readOnly={readOnly}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              )}

              {type === 'textarea' && (
                <textarea
                  value={val as string}
                  onChange={(e) => handleFieldChange(code, e.target.value)}
                  readOnly={readOnly}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              )}

              {type === 'date' && (
                <input
                  type="date"
                  value={val as string}
                  onChange={(e) => handleFieldChange(code, e.target.value)}
                  readOnly={readOnly}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              )}

              {(type === 'select' || type === 'select_multiple') && (
                <select
                  value={val as string}
                  onChange={(e) => handleFieldChange(code, e.target.value)}
                  disabled={readOnly}
                  multiple={type === 'select_multiple'}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">--</option>
                  {Array.isArray(field.field_options) && (field.field_options as Array<{ value: string; label: string }>).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
