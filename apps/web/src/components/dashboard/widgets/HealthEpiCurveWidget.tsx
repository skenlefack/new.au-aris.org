'use client';

import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { WidgetWrapper } from './WidgetWrapper';
import type { EpiCurvePoint } from '../demo-data';

interface HealthEpiCurveWidgetProps {
  title: string;
  subtitle?: string;
  data: EpiCurvePoint[];
  demo?: boolean;
}

export function HealthEpiCurveWidget({ title, subtitle, data, demo }: HealthEpiCurveWidgetProps) {
  // Show every 4th week label
  const tickFormatter = (value: string, index: number) => index % 4 === 0 ? value : '';

  return (
    <WidgetWrapper title={title} subtitle={subtitle} demo={demo}>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickFormatter={tickFormatter}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: 12,
            }}
          />
          <Legend verticalAlign="top" height={30} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="cases" name="Cases" fill="#3b82f6" fillOpacity={0.7} radius={[2, 2, 0, 0]} maxBarSize={8} />
          <Bar dataKey="deaths" name="Deaths" fill="#ef4444" fillOpacity={0.8} radius={[2, 2, 0, 0]} maxBarSize={8} />
          <Line
            type="monotone"
            dataKey="movingAvg"
            name="4-Week Moving Avg"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            strokeDasharray="4 2"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}
