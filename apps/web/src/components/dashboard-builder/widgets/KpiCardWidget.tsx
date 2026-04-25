'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardWidgetProps {
  value: string | number;
  label: string;
  trend?: number;       // percentage change, e.g. 12.5 or -3.2
  thresholds?: {
    green?: number;
    yellow?: number;
  };
  prefix?: string;
  suffix?: string;
}

export function KpiCardWidget({
  value,
  label,
  trend,
  thresholds,
  prefix,
  suffix,
}: KpiCardWidgetProps) {
  // Determine color from thresholds (compared against numeric value)
  let accentColor = '#1F4E79'; // default blue
  if (thresholds && typeof value === 'number') {
    if (thresholds.green != null && value >= thresholds.green) {
      accentColor = '#16a34a'; // green
    } else if (thresholds.yellow != null && value >= thresholds.yellow) {
      accentColor = '#ca8a04'; // yellow
    } else {
      accentColor = '#dc2626'; // red
    }
  }

  const TrendIcon =
    trend != null && trend > 0
      ? TrendingUp
      : trend != null && trend < 0
        ? TrendingDown
        : Minus;

  const trendColor =
    trend != null && trend > 0
      ? 'text-green-600'
      : trend != null && trend < 0
        ? 'text-red-600'
        : 'text-gray-400';

  return (
    <div className="flex h-full flex-col justify-between p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <div className="mt-2 flex items-end gap-2">
        <span
          className="text-3xl font-bold leading-none"
          style={{ color: accentColor }}
        >
          {prefix}
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix}
        </span>
        {trend != null && (
          <span className={cn('flex items-center gap-0.5 text-sm font-medium', trendColor)}>
            <TrendIcon className="h-4 w-4" />
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
