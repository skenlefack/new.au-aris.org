'use client';

import React from 'react';

interface CounterWidgetProps {
  value: number | string;
  label: string;
  icon?: string;
  color?: string;
  format?: 'number' | 'percent' | 'currency';
}

function formatValue(value: number | string, format?: string): string {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'percent':
      return `${(value ?? 0).toLocaleString()}%`;
    case 'currency':
      return `$${(value ?? 0).toLocaleString()}`;
    default:
      return (value ?? 0).toLocaleString();
  }
}

export function CounterWidget({ value, label, icon, color = '#1F4E79', format }: CounterWidgetProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-4 text-center">
      {icon && (
        <span className="mb-2 text-2xl" role="img" aria-label={label}>
          {icon}
        </span>
      )}
      <span
        className="text-4xl font-extrabold leading-none tracking-tight"
        style={{ color }}
      >
        {formatValue(value, format)}
      </span>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
    </div>
  );
}
