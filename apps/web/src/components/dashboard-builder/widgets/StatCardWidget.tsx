'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';

interface StatCardWidgetProps {
  value: number;
  previousValue?: number;
  label: string;
  icon?: string;
  color?: string;
}

export function StatCardWidget({
  value,
  previousValue,
  label,
  color = '#1F4E79',
}: StatCardWidgetProps) {
  const t = useTranslations('dashboard');
  const delta =
    previousValue != null && previousValue !== 0
      ? ((value - previousValue) / Math.abs(previousValue)) * 100
      : null;

  const isPositive = delta != null && delta > 0;
  const isNegative = delta != null && delta < 0;

  return (
    <div className="flex h-full flex-col justify-center p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <div className="mt-2 flex items-end gap-3">
        <span
          className="text-4xl font-bold leading-none"
          style={{ color }}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {delta != null && (
          <span
            className={cn(
              'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
              isPositive && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
              isNegative && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
              !isPositive && !isNegative && 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
            )}
          >
            {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : null}
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
      </div>
      {previousValue != null && (
        <p className="mt-1 text-[11px] text-gray-400">
          {t('dbPrevious')} {previousValue.toLocaleString()}
        </p>
      )}
    </div>
  );
}
