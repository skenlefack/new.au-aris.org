'use client';

import React from 'react';
import {
  FolderKanban,
  MapPin,
  Users,
  Home,
  GraduationCap,
  UserCheck,
  Accessibility,
  DollarSign,
} from 'lucide-react';
import type { PaidAggregates } from '@/lib/paid';

interface PAIDKpiCardsProps {
  agg: PaidAggregates;
  t: (key: string) => string;
}

const fmt = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

export function PAIDKpiCards({ agg, t }: PAIDKpiCardsProps) {
  const cards = [
    { label: t('totalProjects'), value: agg.totalProjects, icon: FolderKanban, color: '#1565C0' },
    { label: t('allCountries'), value: agg.totalCountries, icon: MapPin, color: '#00838F' },
    { label: 'RECs', value: agg.totalRecs, icon: Users, color: '#2E7D32' },
    { label: 'Submissions', value: agg.totalSubmissions, icon: Home, color: '#6A1B9A' },
    { label: 'Qty Implemented', value: fmt(agg.totalQuantityImplemented), icon: GraduationCap, color: '#E65100' },
    { label: 'Qty Targeted', value: fmt(agg.totalQuantityTargeted), icon: UserCheck, color: '#AD1457' },
    { label: t('completionRate'), value: `${agg.completionRate}%`, icon: Accessibility, color: '#4E342E' },
    { label: 'Expenditure', value: `$${fmt(agg.totalExpenditure)}`, icon: DollarSign, color: '#37474F' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {cards.map((c) => (
        <div
          key={c.label}
          className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          style={{ borderTop: `3px solid ${c.color}` }}
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-500">{c.label}</p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{c.value}</p>
            </div>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${c.color}15`, color: c.color }}
            >
              <c.icon className="h-4 w-4" />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
