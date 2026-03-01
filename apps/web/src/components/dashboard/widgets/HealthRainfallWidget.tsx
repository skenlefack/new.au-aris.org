'use client';

import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { WidgetWrapper } from './WidgetWrapper';
import type { RainfallPoint } from '../demo-data';

interface HealthRainfallWidgetProps {
  title: string;
  subtitle?: string;
  data: RainfallPoint[];
  demo?: boolean;
}

export function HealthRainfallWidget({ title, subtitle, data, demo }: HealthRainfallWidgetProps) {
  return (
    <WidgetWrapper title={title} subtitle={subtitle} demo={demo}>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="rain" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} label={{ value: 'mm', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#9ca3af' } }} />
          <YAxis yAxisId="cases" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} label={{ value: 'Cases', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: '#9ca3af' } }} />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: 12,
            }}
          />
          <Legend verticalAlign="top" height={30} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="rain" dataKey="rainfall" name="Rainfall (mm)" fill="#3b82f6" fillOpacity={0.3} radius={[3, 3, 0, 0]} maxBarSize={24} />
          <Line yAxisId="rain" type="monotone" dataKey="normalRainfall" name="Normal Rainfall" stroke="#93c5fd" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
          <Line yAxisId="cases" type="monotone" dataKey="rvfCases" name="RVF Cases" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3, fill: '#ef4444' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}
