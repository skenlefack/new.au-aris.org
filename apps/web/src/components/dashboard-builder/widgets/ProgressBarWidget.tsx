'use client';

import React from 'react';

interface ProgressBarWidgetProps {
  value: number;
  target: number;
  label?: string;
  color?: string;
  showPercentage?: boolean;
}

export function ProgressBarWidget({
  value,
  target,
  label,
  color = '#1F4E79',
  showPercentage = true,
}: ProgressBarWidgetProps) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;

  return (
    <div className="flex h-full flex-col justify-center gap-2 p-4">
      {label && (
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </p>
      )}
      <div className="flex items-center gap-3">
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
        {showPercentage && (
          <span className="min-w-[3rem] text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
            {Math.round(pct)}%
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-400">
        {value.toLocaleString()} / {target.toLocaleString()}
      </p>
    </div>
  );
}
