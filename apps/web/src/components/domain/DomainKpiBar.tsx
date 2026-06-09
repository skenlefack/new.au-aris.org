'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  FileText, Globe, Activity, Target, Shield,
  TrendingUp, TrendingDown, Minus, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiItem {
  label: string;
  value: number;
  displayValue: string;
  icon: React.ReactNode;
  delta?: number;
  suffix?: string;
  color: string;
  gradient: string;
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

/* ── Animated counter hook ── */
function useAnimatedValue(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const from = 0;
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  return value;
}

function AnimatedKpiCard({ item, index }: { item: KpiItem; index: number }) {
  const animatedVal = useAnimatedValue(item.value, 1400);
  const displayVal = item.value === 0
    ? item.displayValue
    : item.displayValue.replace(String(item.value), String(animatedVal));

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300',
        'hover:shadow-lg hover:-translate-y-0.5 hover:border-transparent',
        'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900',
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Gradient accent line */}
      <div
        className="absolute inset-x-0 top-0 h-[3px] opacity-80 group-hover:opacity-100 transition-opacity"
        style={{ background: item.gradient }}
      />

      {/* Background glow on hover */}
      <div
        className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20"
        style={{ backgroundColor: item.color }}
      />

      <div className="relative flex items-start justify-between">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: `${item.color}15`, color: item.color }}
        >
          {item.icon}
        </div>

        {item.delta !== undefined && item.delta !== 0 && (
          <div className={cn(
            'flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-[10px] font-bold tracking-wide',
            item.delta > 0
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400',
          )}>
            {item.delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {item.delta > 0 ? '+' : ''}{item.delta}%
          </div>
        )}
      </div>

      <div className="relative mt-3">
        <p className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          {displayVal}
          {item.suffix && (
            <span className="ml-0.5 text-sm font-medium text-gray-400 dark:text-gray-500">
              {item.suffix}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {item.label}
        </p>
      </div>
    </div>
  );
}

export function DomainKpiBar({ kpis, loading }: DomainKpiBarProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="absolute inset-x-0 top-0 h-[3px] animate-pulse bg-gray-200 dark:bg-gray-700" />
            <div className="h-9 w-9 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="mt-3 space-y-1.5">
              <div className="h-7 w-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
              <div className="h-3 w-20 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!kpis) return null;

  const delta = kpis.trend.delta;

  const items: KpiItem[] = [
    {
      label: 'Soumissions',
      value: kpis.totalSubmissions,
      displayValue: kpis.totalSubmissions.toLocaleString(),
      icon: <FileText className="h-4 w-4" />,
      delta,
      color: '#2563eb',
      gradient: 'linear-gradient(90deg, #2563eb, #60a5fa)',
    },
    {
      label: 'Pays actifs',
      value: kpis.activeCountries,
      displayValue: String(kpis.activeCountries),
      icon: <Globe className="h-4 w-4" />,
      suffix: '/55',
      color: '#0891b2',
      gradient: 'linear-gradient(90deg, #0891b2, #67e8f9)',
    },
    {
      label: 'Campagnes actives',
      value: kpis.activeCampaigns,
      displayValue: String(kpis.activeCampaigns),
      icon: <Activity className="h-4 w-4" />,
      color: '#7c3aed',
      gradient: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
    },
    {
      label: 'Taux de completion',
      value: kpis.completionRate,
      displayValue: `${kpis.completionRate}%`,
      icon: <Target className="h-4 w-4" />,
      color: '#16a34a',
      gradient: 'linear-gradient(90deg, #16a34a, #4ade80)',
    },
    {
      label: 'Qualite des donnees',
      value: kpis.qualityScore,
      displayValue: `${kpis.qualityScore}%`,
      icon: <Shield className="h-4 w-4" />,
      color: '#ea580c',
      gradient: 'linear-gradient(90deg, #ea580c, #fb923c)',
    },
    {
      label: 'Tendance',
      value: Math.abs(delta),
      displayValue: delta > 0 ? `+${delta}%` : delta < 0 ? `${delta}%` : '0%',
      icon: delta > 0 ? <TrendingUp className="h-4 w-4" /> : delta < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />,
      delta,
      color: delta >= 0 ? '#16a34a' : '#dc2626',
      gradient: delta >= 0
        ? 'linear-gradient(90deg, #16a34a, #4ade80)'
        : 'linear-gradient(90deg, #dc2626, #f87171)',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item, i) => (
        <AnimatedKpiCard key={i} item={item} index={i} />
      ))}
    </div>
  );
}
