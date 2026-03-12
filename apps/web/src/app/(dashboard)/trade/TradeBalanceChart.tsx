'use client';

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

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

interface TradeBalanceChartProps {
  data: Array<{ period: string; exports: number; imports: number; balance: number }>;
}

export default function TradeBalanceChart({ data }: TradeBalanceChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickFormatter={(v) => formatUsd(Math.abs(v))}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatUsd(Math.abs(value)),
            name,
          ]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #E5E7EB',
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="exports"
          fill="#1B5E20"
          name="Exports"
          radius={[4, 4, 0, 0]}
          barSize={28}
        />
        <Bar
          dataKey="imports"
          fill="#E65100"
          name="Imports"
          radius={[4, 4, 0, 0]}
          barSize={28}
        />
        <Line
          type="monotone"
          dataKey="balance"
          stroke="#006064"
          strokeWidth={2}
          dot={{ r: 4, fill: '#006064' }}
          name="Balance"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
