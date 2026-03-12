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

interface CaptureTrendsChartProps {
  data: Array<{ year: number; marine: number; inland: number; aquaculture: number }>;
}

export default function CaptureTrendsChart({ data }: CaptureTrendsChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="marineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#006064" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#006064" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="inlandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1B5E20" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#1B5E20" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="aquacultureGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#E65100" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#E65100" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
        />
        <Tooltip
          formatter={(value: number) => [
            `${(value / 1_000_000).toFixed(2)}M tonnes`,
          ]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #E5E7EB',
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="marine"
          stackId="1"
          stroke="#006064"
          strokeWidth={2}
          fill="url(#marineGrad)"
          name="Marine"
        />
        <Area
          type="monotone"
          dataKey="inland"
          stackId="1"
          stroke="#1B5E20"
          strokeWidth={2}
          fill="url(#inlandGrad)"
          name="Inland"
        />
        <Area
          type="monotone"
          dataKey="aquaculture"
          stackId="1"
          stroke="#E65100"
          strokeWidth={2}
          fill="url(#aquacultureGrad)"
          name="Aquaculture"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
