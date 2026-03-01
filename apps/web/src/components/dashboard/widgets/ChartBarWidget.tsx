'use client';

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { WidgetWrapper } from './WidgetWrapper';

interface ChartBarWidgetProps {
  title: string;
  subtitle?: string;
  data: Array<Record<string, any>>;
  bars: Array<{
    dataKey: string;
    label: string;
    color: string;
  }>;
  xKey: string;
  horizontal?: boolean;
  showValues?: boolean;
  demo?: boolean;
}

export function ChartBarWidget({ title, subtitle, data, bars, xKey, horizontal, showValues, demo }: ChartBarWidgetProps) {
  const layout = horizontal ? 'vertical' : 'horizontal';

  return (
    <WidgetWrapper title={title} subtitle={subtitle} demo={demo}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          layout={layout}
          margin={horizontal
            ? { top: 5, right: 30, left: 80, bottom: 5 }
            : { top: 5, right: 10, left: -10, bottom: 5 }
          }
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey={xKey}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
                width={75}
              />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            </>
          )}
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: 12,
            }}
          />
          {bars.map((bar) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.label}
              fill={bar.color}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={horizontal ? 20 : 40}
              label={showValues ? { position: horizontal ? 'right' : 'top', fontSize: 10, fill: '#6b7280' } : false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}
