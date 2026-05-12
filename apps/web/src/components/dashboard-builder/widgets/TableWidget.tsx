'use client';

import React from 'react';
import { useTranslations } from '@/lib/i18n/translations';

interface TableWidgetProps {
  columns: Array<{ key: string; label: string; align?: 'left' | 'center' | 'right' }>;
  rows: Record<string, unknown>[];
  maxRows?: number;
}

export function TableWidget({ columns, rows, maxRows = 50 }: TableWidgetProps) {
  const t = useTranslations('dashboard');
  const displayRows = rows.slice(0, maxRows);

  if (columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        {t('dbNoColumnsConfigured')}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-1">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {columns.map((col) => (
              <th
                key={col.key}
                className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                style={{ textAlign: col.align ?? 'left' }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {displayRows.map((row, ri) => (
            <tr
              key={ri}
              className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="whitespace-nowrap px-3 py-1.5 text-gray-700 dark:text-gray-300"
                  style={{ textAlign: col.align ?? 'left' }}
                >
                  {String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
          {displayRows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-4 text-center text-gray-400"
              >
                {t('dbNoData')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
