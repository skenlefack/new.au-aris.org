'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface InventoryChartProps {
  data: Array<{ category: string; endangered: number; vulnerable: number; leastConcern: number }>;
}

export default function InventoryChart({ data }: InventoryChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={{ stroke: '#E5E7EB' }} />
        <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={{ stroke: '#E5E7EB' }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="endangered" fill="#DC2626" name="Endangered" radius={[2, 2, 0, 0]} />
        <Bar dataKey="vulnerable" fill="#F59E0B" name="Vulnerable" radius={[2, 2, 0, 0]} />
        <Bar dataKey="leastConcern" fill="#16A34A" name="Least Concern" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
