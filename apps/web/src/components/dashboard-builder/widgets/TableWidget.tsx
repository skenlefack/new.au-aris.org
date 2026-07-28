'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from '@/lib/i18n/translations';

interface TableWidgetProps {
  columns: Array<{ key: string; label: string; align?: 'left' | 'center' | 'right' }>;
  rows: Record<string, unknown>[];
  maxRows?: number;
  config?: Record<string, unknown>;
}

export function TableWidget({ columns, rows, maxRows = 50, config }: TableWidgetProps) {
  const t = useTranslations('dashboard');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const displayRows = useMemo(() => {
    if (!sortKey) return rows.slice(0, maxRows);
    return [...rows].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      const na = Number(va), nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return sortDir === 'asc' ? na - nb : nb - na;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    }).slice(0, maxRows);
  }, [rows, sortKey, sortDir, maxRows]);

  if (columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        {t('dbNoColumnsConfigured')}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-1" style={{ maxHeight: (config?.maxHeight as string) || '400px' }}>
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10">
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => {
                  if (sortKey === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                  else { setSortKey(col.key); setSortDir('desc'); }
                }}
                className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                style={{ textAlign: col.align ?? 'left' }}
              >
                {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '\u2191' : '\u2193') : ''}
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
