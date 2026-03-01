'use client';

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
  Legend,
} from 'recharts';
import { WidgetWrapper } from './WidgetWrapper';
import type { MonthlyTrendPoint } from '../demo-data';

interface ChartLineWidgetProps {
  title: string;
  subtitle?: string;
  data: MonthlyTrendPoint[];
  lines: Array<{
    dataKey: string;
    label: string;
    color: string;
    type?: 'line' | 'area';
  }>;
  xKey?: string;
  area?: boolean;
  demo?: boolean;
}

export function ChartLineWidget({ title, subtitle, data, lines, xKey = 'label', area, demo }: ChartLineWidgetProps) {
  const ChartComponent = area ? AreaChart : LineChart;

  return (
    <WidgetWrapper title={title} subtitle={subtitle} demo={demo}>
      <ResponsiveContainer width="100%" height={280}>
        <ChartComponent data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: 12,
            }}
          />
          <Legend
            verticalAlign="top"
            height={30}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11 }}
          />
          {lines.map((line) =>
            area || line.type === 'area' ? (
              <Area
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.label}
                stroke={line.color}
                fill={line.color}
                fillOpacity={0.1}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
            ) : (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.label}
                stroke={line.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
            ),
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}
