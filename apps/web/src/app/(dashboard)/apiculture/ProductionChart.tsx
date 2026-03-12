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

interface ProductionChartProps {
  data: Array<{ year: number; honey: number; wax: number; propolis: number }>;
}

export default function ProductionChart({ data }: ProductionChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="honeyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#D97706" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="waxGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#92400E" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#92400E" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="propolisGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#065F46" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#065F46" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={{ stroke: '#E5E7EB' }} />
        <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={{ stroke: '#E5E7EB' }} tickFormatter={(v) => `${(v / 1_000).toFixed(0)}K`} />
        <Tooltip formatter={(value: number) => [`${value.toLocaleString()} tonnes`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="honey" stackId="1" stroke="#D97706" strokeWidth={2} fill="url(#honeyGrad)" name="Honey" />
        <Area type="monotone" dataKey="wax" stackId="1" stroke="#92400E" strokeWidth={2} fill="url(#waxGrad)" name="Beeswax" />
        <Area type="monotone" dataKey="propolis" stackId="1" stroke="#065F46" strokeWidth={2} fill="url(#propolisGrad)" name="Propolis" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
