'use client';

import React from 'react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface AxisConfig {
  key: string;
  label: string;
  color: string;
}

interface DualAxisWidgetProps {
  data: Array<Record<string, number>>;
  leftAxis: AxisConfig;
  rightAxis: AxisConfig;
  xKey?: string;
}

export function DualAxisWidget({ data, leftAxis, rightAxis, xKey = 'name' }: DualAxisWidgetProps) {
  const t = useTranslations('dashboard');
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        {t('dbConfigureDataSource')}
      </div>
    );
  }

  return (
    <div className="h-full w-full p-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11 }}
            label={{ value: leftAxis.label, angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: leftAxis.color } }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            label={{ value: rightAxis.label, angle: 90, position: 'insideRight', style: { fontSize: 10, fill: rightAxis.color } }}
          />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar
            yAxisId="left"
            dataKey={leftAxis.key}
            name={leftAxis.label}
            fill={leftAxis.color}
            radius={[4, 4, 0, 0]}
            opacity={0.8}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={rightAxis.key}
            name={rightAxis.label}
            stroke={rightAxis.color}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
