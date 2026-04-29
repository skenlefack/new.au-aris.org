'use client';

import React from 'react';
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

interface EpiCurveData {
  week: number;
  cases: number;
  deaths: number;
  movingAvg?: number;
}

interface EpiCurveWidgetProps {
  data: EpiCurveData[];
  title?: string;
}

export function EpiCurveWidget({ data, title }: EpiCurveWidgetProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Configure data source
      </div>
    );
  }

  return (
    <div className="h-full w-full p-2">
      {title && (
        <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400 text-center">
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} label={{ value: 'Epi Week', position: 'insideBottom', offset: -2, fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="cases" name="Cases" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          <Bar dataKey="deaths" name="Deaths" fill="#ef4444" radius={[2, 2, 0, 0]} />
          {data.some((d) => d.movingAvg != null) && (
            <Line
              dataKey="movingAvg"
              name="Moving Avg"
              type="monotone"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
