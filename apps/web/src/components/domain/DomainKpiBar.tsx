'use client';

import React from 'react';
import { FileText, Globe, Activity, Target, Shield, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiItem {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  delta?: number; // percentage change
  suffix?: string;
}

interface DomainKpiBarProps {
  kpis: {
    totalSubmissions: number;
    activeCountries: number;
    activeCampaigns: number;
    completionRate: number;
    qualityScore: number;
    trend: { current: number; previous: number; delta: number };
  } | null;
  loading?: boolean;
}

export function DomainKpiBar({ kpis, loading }: DomainKpiBarProps) {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900" />
        ))}
      </div>
    );
  }

  const delta = kpis.trend.delta;

  const items: KpiItem[] = [
    { label: 'Soumissions', value: kpis.totalSubmissions.toLocaleString(), icon: <FileText className="h-4 w-4" />, delta },
    { label: 'Pays actifs', value: kpis.activeCountries, icon: <Globe className="h-4 w-4" />, suffix: '/55' },
    { label: 'Campagnes actives', value: kpis.activeCampaigns, icon: <Activity className="h-4 w-4" /> },
    { label: 'Taux completion', value: `${kpis.completionRate}%`, icon: <Target className="h-4 w-4" /> },
    { label: 'Qualite donnees', value: `${kpis.qualityScore}%`, icon: <Shield className="h-4 w-4" /> },
    { label: 'Tendance', value: delta > 0 ? `+${delta}%` : `${delta}%`, icon: delta > 0 ? <TrendingUp className="h-4 w-4" /> : delta < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />, delta },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1F4E79]/10 text-[#1F4E79] dark:bg-[#1F4E79]/20 dark:text-blue-300">
              {item.icon}
            </div>
            {item.delta !== undefined && item.delta !== 0 && (
              <span className={cn(
                'text-[10px] font-semibold rounded-full px-1.5 py-0.5',
                item.delta > 0 ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
              )}>
                {item.delta > 0 ? '+' : ''}{item.delta}%
              </span>
            )}
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {item.value}{item.suffix && <span className="text-xs font-normal text-gray-400">{item.suffix}</span>}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
