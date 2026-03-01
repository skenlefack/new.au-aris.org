'use client';

import React from 'react';
import { WidgetWrapper } from './WidgetWrapper';
import { cn } from '@/lib/utils';

interface HeatmapCell {
  country: string;
  countryCode: string;
  month: string;
  value: number;
}

interface ChartHeatmapWidgetProps {
  title: string;
  subtitle?: string;
  data: HeatmapCell[];
  demo?: boolean;
}

function getHeatColor(value: number, max: number): string {
  if (max === 0) return '#f3f4f6';
  const ratio = value / max;
  if (ratio === 0) return '#f3f4f6';
  if (ratio < 0.2) return '#dcfce7';
  if (ratio < 0.4) return '#86efac';
  if (ratio < 0.6) return '#fbbf24';
  if (ratio < 0.8) return '#f97316';
  return '#ef4444';
}

export function ChartHeatmapWidget({ title, subtitle, data, demo }: ChartHeatmapWidgetProps) {
  const countries = [...new Set(data.map((d) => d.country))];
  const months = [...new Set(data.map((d) => d.month))];
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const lookup = new Map<string, number>();
  data.forEach((d) => lookup.set(`${d.country}-${d.month}`, d.value));

  return (
    <WidgetWrapper title={title} subtitle={subtitle} demo={demo}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white dark:bg-gray-800 z-10 text-left px-2 py-1.5 text-gray-500 font-medium">
                Country
              </th>
              {months.map((m) => (
                <th key={m} className="px-1 py-1.5 text-center text-gray-400 font-medium whitespace-nowrap">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {countries.map((country) => (
              <tr key={country}>
                <td className="sticky left-0 bg-white dark:bg-gray-800 z-10 px-2 py-1 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">
                  {country}
                </td>
                {months.map((month) => {
                  const val = lookup.get(`${country}-${month}`) ?? 0;
                  return (
                    <td key={month} className="px-0.5 py-0.5">
                      <div
                        className="rounded-sm w-full h-6 flex items-center justify-center text-[10px] font-medium cursor-default transition-transform hover:scale-110"
                        style={{ backgroundColor: getHeatColor(val, maxValue), color: val / maxValue > 0.5 ? '#fff' : '#374151' }}
                        title={`${country} - ${month}: ${val}`}
                      >
                        {val > 0 ? val : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 text-[10px] text-gray-500">
        <span>Low</span>
        {['#dcfce7', '#86efac', '#fbbf24', '#f97316', '#ef4444'].map((c) => (
          <div key={c} className="w-4 h-3 rounded-sm" style={{ backgroundColor: c }} />
        ))}
        <span>High</span>
      </div>
    </WidgetWrapper>
  );
}
