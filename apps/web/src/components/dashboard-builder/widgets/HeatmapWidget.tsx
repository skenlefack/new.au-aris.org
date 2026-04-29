'use client';

import React from 'react';

interface HeatmapWidgetProps {
  rows: Array<{ label: string; values: number[] }>;
  columns: string[];
  colorScale?: 'green' | 'blue' | 'red';
}

const SCALES: Record<string, [string, string, string]> = {
  green: ['#f0fdf4', '#22c55e', '#14532d'],
  blue: ['#eff6ff', '#3b82f6', '#1e3a5f'],
  red: ['#fef2f2', '#ef4444', '#7f1d1d'],
};

function cellColor(value: number, min: number, max: number, scale: [string, string, string]): string {
  if (max === min) return scale[1];
  const ratio = (value - min) / (max - min);
  // Simple 3-stop interpolation via opacity on the mid color
  if (ratio < 0.5) {
    const opacity = 0.15 + ratio * 1.2;
    return `color-mix(in srgb, ${scale[1]} ${Math.round(opacity * 100)}%, ${scale[0]})`;
  }
  const opacity = (ratio - 0.5) * 2;
  return `color-mix(in srgb, ${scale[2]} ${Math.round(opacity * 100)}%, ${scale[1]})`;
}

export function HeatmapWidget({ rows, columns, colorScale = 'blue' }: HeatmapWidgetProps) {
  if (!rows || rows.length === 0 || !columns || columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Configure data source
      </div>
    );
  }

  const allValues = rows.flatMap((r) => r.values);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const scale = SCALES[colorScale] ?? SCALES.blue;

  return (
    <div className="h-full overflow-auto p-2">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white dark:bg-gray-900 px-2 py-1 text-left font-medium text-gray-500" />
            {columns.map((col) => (
              <th key={col} className="px-2 py-1 text-center font-medium text-gray-500 dark:text-gray-400">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="sticky left-0 bg-white dark:bg-gray-900 px-2 py-1 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {row.label}
              </td>
              {row.values.map((val, i) => (
                <td
                  key={i}
                  className="px-2 py-1 text-center font-semibold text-white rounded-sm"
                  style={{ backgroundColor: cellColor(val, min, max, scale) }}
                  title={`${row.label} / ${columns[i]}: ${val.toLocaleString()}`}
                >
                  {val.toLocaleString()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
