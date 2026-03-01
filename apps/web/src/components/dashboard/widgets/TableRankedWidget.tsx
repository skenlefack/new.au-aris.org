'use client';

import React from 'react';
import { Trophy } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import { cn } from '@/lib/utils';

interface RankedRow {
  rank: number;
  label: string;
  value: number;
  formattedValue: string;
  barPercent: number;
  color?: string;
}

interface TableRankedWidgetProps {
  title: string;
  subtitle?: string;
  rows: RankedRow[];
  demo?: boolean;
}

const RANK_COLORS = ['#f59e0b', '#9ca3af', '#cd7f32']; // gold, silver, bronze

export function TableRankedWidget({ title, subtitle, rows, demo }: TableRankedWidgetProps) {
  return (
    <WidgetWrapper title={title} subtitle={subtitle} demo={demo} noPadding>
      <div className="divide-y divide-gray-50 dark:divide-gray-700/30">
        {rows.map((row) => (
          <div key={row.rank} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0',
                row.rank <= 3
                  ? 'text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
              )}
              style={row.rank <= 3 ? { backgroundColor: RANK_COLORS[row.rank - 1] } : undefined}
            >
              {row.rank}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{row.label}</span>
                <span className="text-xs font-semibold text-gray-900 dark:text-white ml-2 flex-shrink-0">{row.formattedValue}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${row.barPercent}%`,
                    backgroundColor: row.color ?? 'var(--color-accent)',
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </WidgetWrapper>
  );
}
