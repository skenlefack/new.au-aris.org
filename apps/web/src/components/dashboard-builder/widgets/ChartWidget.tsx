'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

type ChartType = 'LINE' | 'BAR' | 'PIE' | 'STACKED_BAR' | 'AREA';

interface ChartWidgetProps {
  type: ChartType;
  data: Record<string, unknown>[];
  config?: {
    xKey?: string;
    yKeys?: string[];
    colors?: string[];
    showGrid?: boolean;
    showLegend?: boolean;
    nameKey?: string;
    valueKey?: string;
    layout?: 'horizontal' | 'vertical';
    variant?: string;
  };
}

const DEFAULT_COLORS = [
  '#1F4E79', '#C9A227', '#2563eb', '#16a34a', '#dc2626',
  '#9333ea', '#0891b2', '#ea580c',
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <p className="mb-1 text-[11px] font-semibold text-gray-700 dark:text-gray-200">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-[11px]">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500 dark:text-gray-400">{p.name}:</span>
          <span className="font-bold tabular-nums" style={{ color: p.color }}>
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** For vertical bar charts, compute a min height so every bar is visible. */
function verticalBarMinHeight(dataLen: number): number {
  // ~32px per bar + 60px padding (axes, legend)
  return Math.max(300, dataLen * 32 + 60);
}

export function ChartWidget({ type, data, config }: ChartWidgetProps) {
  const t = useTranslations('dashboard');
  const cfg = config ?? {};
  const xKey = (cfg.xKey as string) ?? 'name';
  const yKeys = (cfg.yKeys as string[]) ?? ['value'];
  const colors = (cfg.colors as string[]) ?? DEFAULT_COLORS;
  const showGrid = (cfg.showGrid as boolean) ?? true;
  const showLegend = (cfg.showLegend as boolean) ?? true;
  const nameKey = (cfg.nameKey as string) ?? 'name';
  const valueKey = (cfg.valueKey as string) ?? 'value';
  const isVertical = cfg.layout === 'vertical';

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
        <BarChart3 className="h-8 w-8 text-gray-300 dark:text-gray-600" />
        <p className="text-xs font-medium">{t('dbNoData')}</p>
      </div>
    );
  }

  // Compute max label length for vertical bars to size YAxis width
  const yAxisWidth = isVertical
    ? Math.min(160, Math.max(80, ...data.map((d) => String((d as any)[xKey] ?? '').length * 7)))
    : undefined;

  const renderChart = () => {
    switch (type) {
      case 'LINE':
        return (
          <LineChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            {yKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        );

      case 'BAR':
        return (
          <BarChart data={data} layout={isVertical ? 'vertical' : 'horizontal'}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
            {isVertical ? (
              <>
                <YAxis dataKey={xKey} type="category" tick={{ fontSize: 10 }} width={yAxisWidth} interval={0} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
              </>
            ) : (
              <>
                <XAxis dataKey={xKey} tick={{ fontSize: 11 }} interval={0} angle={data.length > 6 ? -35 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 60 : 30} />
                <YAxis tick={{ fontSize: 11 }} />
              </>
            )}
            <Tooltip content={<CustomTooltip />} />
            {showLegend && yKeys.length > 1 && <Legend />}
            {yKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[i % colors.length]}
                radius={isVertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        );

      case 'STACKED_BAR':
        return (
          <BarChart data={data} layout={isVertical ? 'vertical' : 'horizontal'}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
            {isVertical ? (
              <>
                <YAxis dataKey={xKey} type="category" tick={{ fontSize: 10 }} width={yAxisWidth} interval={0} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
              </>
            ) : (
              <>
                <XAxis dataKey={xKey} tick={{ fontSize: 11 }} interval={0} angle={data.length > 6 ? -35 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 60 : 30} />
                <YAxis tick={{ fontSize: 11 }} />
              </>
            )}
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            {yKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="stack"
                fill={colors[i % colors.length]}
                radius={i === yKeys.length - 1 ? (isVertical ? [0, 4, 4, 0] : [4, 4, 0, 0]) : undefined}
              />
            ))}
          </BarChart>
        );

      case 'AREA':
        return (
          <AreaChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            {yKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[i % colors.length]}
                fill={colors[i % colors.length]}
                fillOpacity={0.15}
              />
            ))}
          </AreaChart>
        );

      case 'PIE':
        if (cfg.variant !== 'classic' && data?.length) {
          const total = data.reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0);
          const pieColors = colors.length >= data.length ? colors : ['#1F4E79', '#C9A227', '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#0891b2', '#ea580c', '#6366f1', '#14b8a6'];
          let cumPercent = 0;
          const segments = data.map((d, i) => {
            const pct = total > 0 ? (Number(d[valueKey]) / total) * 100 : 0;
            const from = cumPercent;
            cumPercent += pct;
            return `${pieColors[i % pieColors.length]} ${from}% ${cumPercent}%`;
          });
          const gradient = `conic-gradient(${segments.join(', ')})`;

          return (
            <div className="flex items-center gap-5 h-full p-3">
              <div className="relative flex-shrink-0">
                <div className="rounded-full shadow-inner" style={{ width: 130, height: 130, background: gradient }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full bg-white dark:bg-gray-900 shadow-sm" style={{ width: 65, height: 65 }}>
                    <div className="flex h-full flex-col items-center justify-center">
                      <span className="text-lg font-extrabold text-gray-900 dark:text-white">{total.toLocaleString()}</span>
                      <span className="text-[9px] font-medium text-gray-400">Total</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 min-w-0 overflow-auto max-h-full">
                {data.slice(0, 10).map((d, i) => {
                  const pct = total > 0 ? ((Number(d[valueKey]) / total) * 100).toFixed(0) : '0';
                  return (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                      <span className="truncate text-gray-600 dark:text-gray-300">{String(d[nameKey] || '')}</span>
                      <span className="ml-auto font-bold tabular-nums text-gray-800 dark:text-gray-100">{Number(d[valueKey]).toLocaleString()}</span>
                      <span className="text-[9px] font-medium text-gray-400 tabular-nums w-7 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }
        return (
          <PieChart>
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            <Pie
              data={data}
              dataKey={valueKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              outerRadius="75%"
              label={({ name, percent }: { name: string; percent: number }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      default:
        return (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            {t('dbUnsupportedChartType', { type })}
          </div>
        );
    }
  };

  // For vertical bar/stacked_bar, compute a min-height so all bars are visible,
  // but let the parent stretch taller if its sibling (e.g. a MAP) is bigger.
  const needsDynamicHeight = isVertical && (type === 'BAR' || type === 'STACKED_BAR');
  const dynamicMinHeight = needsDynamicHeight ? verticalBarMinHeight(data.length) : undefined;

  return (
    <div
      className="w-full p-2"
      style={{
        height: '100%',
        minHeight: dynamicMinHeight ? `${dynamicMinHeight}px` : undefined,
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}
