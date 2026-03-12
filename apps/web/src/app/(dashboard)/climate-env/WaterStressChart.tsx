'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface WaterStressChartProps {
  data: Array<{
    year: number;
    eastAfrica: number;
    westAfrica: number;
    centralAfrica: number;
    southernAfrica: number;
    northAfrica: number;
  }>;
}

export default function WaterStressChart({ data }: WaterStressChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={{ stroke: '#E5E7EB' }} />
        <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={{ stroke: '#E5E7EB' }} tickFormatter={(v) => `${v}%`} />
        <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="eastAfrica" stroke="#0891B2" strokeWidth={2} dot={{ r: 3 }} name="East Africa" />
        <Line type="monotone" dataKey="westAfrica" stroke="#D97706" strokeWidth={2} dot={{ r: 3 }} name="West Africa" />
        <Line type="monotone" dataKey="centralAfrica" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} name="Central Africa" />
        <Line type="monotone" dataKey="southernAfrica" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3 }} name="Southern Africa" />
        <Line type="monotone" dataKey="northAfrica" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} name="North Africa" />
      </LineChart>
    </ResponsiveContainer>
  );
}
