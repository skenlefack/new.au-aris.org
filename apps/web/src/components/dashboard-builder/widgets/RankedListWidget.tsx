'use client';

import React from 'react';
import { useTranslations } from '@/lib/i18n/translations';

interface RankedItem {
  rank?: number;
  label?: string;
  text?: string;
  value?: number;
  severity?: string;
}

interface RankedListWidgetProps {
  items: RankedItem[];
  maxItems?: number;
  unit?: string;
}

const MEDALS = ['', '\u{1F947}', '\u{1F948}', '\u{1F949}']; // gold, silver, bronze

const SEVERITY_COLORS: Record<string, string> = {
  high: '#DC2626', medium: '#F59E0B', low: '#059669', critical: '#7C2D12',
};

export function RankedListWidget({ items, maxItems = 10, unit }: RankedListWidgetProps) {
  const t = useTranslations('dashboard');
  if (!items || items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        {t('dbConfigureDataSource')}
      </div>
    );
  }

  const display = items.slice(0, maxItems);
  const hasValues = display.some((d) => d.value != null);
  const maxValue = hasValues ? Math.max(...display.map((d) => d.value ?? 0), 1) : 1;

  return (
    <div className="h-full overflow-auto p-3 space-y-1.5">
      {display.map((item, idx) => {
        const rank = item.rank ?? idx + 1;
        const label = item.label ?? item.text ?? '';
        const value = item.value;
        const pct = hasValues && value != null ? (value / maxValue) * 100 : 0;
        const medal = MEDALS[rank] ?? '';
        const sevColor = item.severity ? SEVERITY_COLORS[item.severity] : undefined;
        return (
          <div key={rank + '-' + label} className="group">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                <span className="inline-block w-6 text-center font-semibold text-gray-400">
                  {medal || `${rank}.`}
                </span>
                {label}
              </span>
              {value != null ? (
                <span className="text-xs font-bold text-gray-600 dark:text-gray-300 ml-2 whitespace-nowrap">
                  {value.toLocaleString()}{unit ? ` ${unit}` : ''}
                </span>
              ) : item.severity ? (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ml-2" style={{ backgroundColor: sevColor ?? '#6B7280' }}>
                  {item.severity}
                </span>
              ) : null}
            </div>
            {hasValues && (
            <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: sevColor ?? (rank <= 3 ? '#C9A227' : '#1F4E79'),
                }}
              />
            </div>
            )}
        );
      })}
    </div>
  );
}
