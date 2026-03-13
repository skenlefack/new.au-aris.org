'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface ClimateChartProps {
  data: Array<{ year: number; temperature: number; rainfall: number }>;
}

export default function ClimateChart({ data }: ClimateChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#E65100" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#E65100" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0277BD" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#0277BD" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        <YAxis
          yAxisId="temp"
          orientation="left"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickFormatter={(v) => `${v}\u00B0C`}
        />
        <YAxis
          yAxisId="rain"
          orientation="right"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickFormatter={(v) => `${v}mm`}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            name === 'Temperature' ? `${value.toFixed(1)}\u00B0C` : `${value}mm`,
          ]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #E5E7EB',
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          yAxisId="temp"
          type="monotone"
          dataKey="temperature"
          stroke="#E65100"
          strokeWidth={2}
          fill="url(#tempGrad)"
          name="Temperature"
        />
        <Area
          yAxisId="rain"
          type="monotone"
          dataKey="rainfall"
          stroke="#0277BD"
          strokeWidth={2}
          fill="url(#rainGrad)"
          name="Rainfall"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
