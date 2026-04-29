'use client';

import React from 'react';

interface RankedItem {
  rank: number;
  label: string;
  value: number;
}

interface RankedListWidgetProps {
  items: RankedItem[];
  maxItems?: number;
  unit?: string;
}

const MEDALS = ['', '\u{1F947}', '\u{1F948}', '\u{1F949}']; // gold, silver, bronze

export function RankedListWidget({ items, maxItems = 10, unit }: RankedListWidgetProps) {
  if (!items || items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Configure data source
      </div>
    );
  }

  const display = items.slice(0, maxItems);
  const maxValue = Math.max(...display.map((d) => d.value), 1);

  return (
    <div className="h-full overflow-auto p-3 space-y-1.5">
      {display.map((item) => {
        const pct = (item.value / maxValue) * 100;
        const medal = MEDALS[item.rank] ?? '';
        return (
          <div key={item.rank + '-' + item.label} className="group">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                <span className="inline-block w-6 text-center font-semibold text-gray-400">
                  {medal || `${item.rank}.`}
                </span>
                {item.label}
              </span>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300 ml-2 whitespace-nowrap">
                {item.value.toLocaleString()}{unit ? ` ${unit}` : ''}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.rank <= 3 ? '#C9A227' : '#1F4E79',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
