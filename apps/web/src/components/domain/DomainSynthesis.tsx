'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { DomainSummary } from '@/lib/api/domain-summary-hooks';

// Lazy-load map to avoid SSR issues with Leaflet
const ChoroplethMap = dynamic(
  () => import('@/components/dashboard/maps/ChoroplethMap').then((m) => m.ChoroplethMap),
  { ssr: false, loading: () => <div className="h-[320px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" /> },
);

const COLORS = ['#1F4E79', '#C9A227', '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#0891b2', '#ea580c'];

interface DomainSynthesisProps {
  synthesis: DomainSummary['synthesis'] | null;
  loading?: boolean;
  domainColor?: string;
}

export function DomainSynthesis({ synthesis, loading, domainColor = '#1F4E79' }: DomainSynthesisProps) {
  if (loading || !synthesis) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[360px] animate-pulse rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900" />
        ))}
      </div>
    );
  }

  // Prepare map data — ChoroplethMap expects CountryOutbreakData shape
  const mapData = synthesis.countryDistribution.map((c) => ({
    code: c.code?.toUpperCase() ?? '',
    name: c.name ?? c.code ?? '',
    outbreaks: 0,
    cases: 0,
    deaths: 0,
    vaccinations: 0,
    submissions: c.count,
    rec: '',
  }));

  // Prepare sub-domain breakdown for donut
  const pieData = synthesis.subDomainBreakdown
    .filter((s) => s.count > 0)
    .map((s, i) => ({
      name: s.label || s.code,
      value: s.count,
      color: COLORS[i % COLORS.length],
    }));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* 1. Africa Choropleth Map */}
      <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Couverture geographique</h3>
          <p className="text-[11px] text-gray-400">Soumissions par pays</p>
        </div>
        <div className="h-[300px]">
          <ChoroplethMap title="Couverture geographique" data={mapData} indicator="submissions" bare />
        </div>
      </div>

      {/* 2. Monthly Trend Area Chart */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tendance mensuelle</h3>
        <p className="text-[11px] text-gray-400 mb-3">12 derniers mois</p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={synthesis.monthlyTrend}>
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={domainColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={domainColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickFormatter={(v) => v.slice(5)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={35} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              formatter={(value: number) => [value.toLocaleString(), 'Soumissions']}
              labelFormatter={(label) => `Mois: ${label}`}
            />
            <Area type="monotone" dataKey="count" stroke={domainColor} strokeWidth={2} fill="url(#trendGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 3. Sub-domain Donut */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Repartition</h3>
        <p className="text-[11px] text-gray-400 mb-3">Par formulaire / sous-domaine</p>
        {pieData.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">Aucune donnee</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
              >
                {pieData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                formatter={(value: number) => value.toLocaleString()}
              />
              <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
