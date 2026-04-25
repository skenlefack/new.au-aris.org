'use client';

import React from 'react';

interface GaugeWidgetProps {
  value: number;
  target: number;
  label?: string;
  unit?: string;
  variant?: 'circular' | 'linear';
}

export function GaugeWidget({
  value,
  target,
  label,
  unit = '%',
  variant = 'linear',
}: GaugeWidgetProps) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;

  // Color based on completion
  const color =
    pct >= 80 ? '#16a34a' : pct >= 50 ? '#ca8a04' : '#dc2626';

  if (variant === 'circular') {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
        <div className="relative">
          <svg width="128" height="128" viewBox="0 0 128 128">
            {/* Background ring */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="10"
              className="dark:stroke-gray-700"
            />
            {/* Progress ring */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 64 64)"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ color }}>
              {Math.round(pct)}
            </span>
            <span className="text-xs text-gray-400">{unit}</span>
          </div>
        </div>
        {label && (
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {label}
          </p>
        )}
        <p className="text-[11px] text-gray-400">
          {value.toLocaleString()} / {target.toLocaleString()}
        </p>
      </div>
    );
  }

  // Linear bar
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-4">
      {label && (
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </p>
      )}
      <div>
        <div className="mb-1 flex items-end justify-between">
          <span className="text-2xl font-bold" style={{ color }}>
            {value.toLocaleString()}
          </span>
          <span className="text-sm text-gray-400">
            / {target.toLocaleString()} {unit}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}
