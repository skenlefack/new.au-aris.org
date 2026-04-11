'use client';

import React, { useCallback, useMemo } from 'react';
import type { FormField, MultilingualText } from '../utils/form-schema';

const ml = (text?: MultilingualText) => text?.en || text?.fr || '';

interface MatrixRow {
  label: MultilingualText;
  key: string;
}

interface MatrixColumn {
  label: MultilingualText;
  key: string;
}

interface MatrixFieldProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
}

const cellClass =
  'w-full min-w-[80px] rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-800 text-right placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white';

export function MatrixField({ field, value, onChange }: MatrixFieldProps) {
  const rows = (field.properties.rows || []) as MatrixRow[];
  const columns = (field.properties.columns || []) as MatrixColumn[];
  const cellType = (field.properties.cellType as string) || 'number';
  const showTotals = (field.properties.showTotals as boolean) || false;

  // Value is Record<rowKey, Record<colKey, unknown>>
  const matrixValue = (value && typeof value === 'object' && !Array.isArray(value))
    ? value as Record<string, Record<string, unknown>>
    : {};

  const handleCellChange = useCallback(
    (rowKey: string, colKey: string, cellValue: unknown) => {
      const updated = { ...matrixValue };
      if (!updated[rowKey]) updated[rowKey] = {};
      updated[rowKey] = { ...updated[rowKey], [colKey]: cellValue };
      onChange(updated);
    },
    [matrixValue, onChange],
  );

  // Compute row totals
  const rowTotals = useMemo(() => {
    if (!showTotals || cellType !== 'number') return {};
    const totals: Record<string, number> = {};
    for (const row of rows) {
      let sum = 0;
      for (const col of columns) {
        const v = Number(matrixValue[row.key]?.[col.key]);
        if (Number.isFinite(v)) sum += v;
      }
      totals[row.key] = sum;
    }
    return totals;
  }, [matrixValue, rows, columns, showTotals, cellType]);

  // Compute column totals
  const colTotals = useMemo(() => {
    if (!showTotals || cellType !== 'number') return {};
    const totals: Record<string, number> = {};
    for (const col of columns) {
      let sum = 0;
      for (const row of rows) {
        const v = Number(matrixValue[row.key]?.[col.key]);
        if (Number.isFinite(v)) sum += v;
      }
      totals[col.key] = sum;
    }
    return totals;
  }, [matrixValue, rows, columns, showTotals, cellType]);

  // Grand total
  const grandTotal = useMemo(() => {
    if (!showTotals || cellType !== 'number') return 0;
    return Object.values(rowTotals).reduce((a, b) => a + b, 0);
  }, [rowTotals, showTotals, cellType]);

  if (rows.length === 0 || columns.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <p className="text-xs text-gray-400">No rows or columns configured for this matrix</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400" />
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                {ml(col.label) || col.key}
              </th>
            ))}
            {showTotals && cellType === 'number' && (
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300">
                Total
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={row.key}
              className={ri % 2 === 0
                ? 'bg-white dark:bg-gray-800'
                : 'bg-gray-50/50 dark:bg-gray-800/30'}
            >
              <td className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {ml(row.label) || row.key}
              </td>
              {columns.map((col) => (
                <td key={col.key} className="px-2 py-1.5">
                  {cellType === 'number' ? (
                    <input
                      type="number"
                      value={matrixValue[row.key]?.[col.key] !== undefined && matrixValue[row.key]?.[col.key] !== null
                        ? String(matrixValue[row.key][col.key])
                        : ''}
                      onChange={(e) =>
                        handleCellChange(row.key, col.key, e.target.value ? Number(e.target.value) : null)
                      }
                      className={cellClass}
                    />
                  ) : (
                    <input
                      type="text"
                      value={(matrixValue[row.key]?.[col.key] as string) || ''}
                      onChange={(e) => handleCellChange(row.key, col.key, e.target.value)}
                      className={cellClass}
                    />
                  )}
                </td>
              ))}
              {showTotals && cellType === 'number' && (
                <td className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {rowTotals[row.key] || 0}
                </td>
              )}
            </tr>
          ))}
          {showTotals && cellType === 'number' && (
            <tr className="border-t border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50">
              <td className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                Total
              </td>
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {colTotals[col.key] || 0}
                </td>
              ))}
              <td className="px-3 py-2 text-center text-xs font-bold text-gray-700 dark:text-gray-200">
                {grandTotal}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
