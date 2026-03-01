'use client';

import React, { useEffect, useState } from 'react';
import {
  Globe, FileBarChart, Syringe, Stethoscope, GraduationCap,
  ClipboardCheck, Database, Layers,
} from 'lucide-react';
import type { DashboardKpis } from './demo-data';

interface KpiItem {
  label: string;
  value: number;
  formatted: string;
  trend: number;
  trendLabel: string;
  icon: React.ReactNode;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}bn`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function AnimatedCounter({ target, suffix }: { target: string; suffix?: string }) {
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    // Simple animation: just show the target after a brief delay
    const timer = setTimeout(() => setDisplay(target), 50);
    return () => clearTimeout(timer);
  }, [target]);

  return (
    <span>
      {display}
      {suffix}
    </span>
  );
}

interface DashboardKpiBarProps {
  kpis: DashboardKpis;
}

export function DashboardKpiBar({ kpis }: DashboardKpiBarProps) {
  const items: KpiItem[] = [
    {
      label: 'Countries Reporting',
      value: kpis.countriesReporting,
      formatted: `${kpis.countriesReporting}/${kpis.totalCountries}`,
      trend: 3,
      trendLabel: 'vs last month',
      icon: <Globe className="h-4 w-4" />,
    },
    {
      label: 'Reports',
      value: kpis.totalReports,
      formatted: formatCompact(kpis.totalReports),
      trend: kpis.reportsTrend,
      trendLabel: 'vs LM',
      icon: <FileBarChart className="h-4 w-4" />,
    },
    {
      label: 'Vaccinated',
      value: kpis.totalVaccinations,
      formatted: formatCompact(kpis.totalVaccinations),
      trend: kpis.vaccinationsTrend,
      trendLabel: 'vs LM',
      icon: <Syringe className="h-4 w-4" />,
    },
    {
      label: 'Treated',
      value: kpis.totalTreated,
      formatted: formatCompact(kpis.totalTreated),
      trend: kpis.treatedTrend,
      trendLabel: 'stable',
      icon: <Stethoscope className="h-4 w-4" />,
    },
    {
      label: 'Trained',
      value: kpis.totalTrained,
      formatted: formatCompact(kpis.totalTrained),
      trend: kpis.trainedTrend,
      trendLabel: 'vs LM',
      icon: <GraduationCap className="h-4 w-4" />,
    },
    {
      label: 'Validation Rate',
      value: kpis.validationRate,
      formatted: `${kpis.validationRate}%`,
      trend: kpis.validationTrend,
      trendLabel: 'vs LM',
      icon: <ClipboardCheck className="h-4 w-4" />,
    },
    {
      label: 'Datasets',
      value: kpis.datasetsImported,
      formatted: String(kpis.datasetsImported),
      trend: kpis.datasetsTrend,
      trendLabel: 'new',
      icon: <Database className="h-4 w-4" />,
    },
    {
      label: 'Records',
      value: kpis.totalRecords,
      formatted: formatCompact(kpis.totalRecords),
      trend: kpis.recordsTrend,
      trendLabel: 'vs LM',
      icon: <Layers className="h-4 w-4" />,
    },
  ];

  return (
    <div
      className="rounded-xl overflow-hidden shadow-sm border"
      style={{
        background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-hover) 50%, var(--color-accent-active) 100%)',
        borderColor: 'var(--color-accent-hover)',
      }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-white/10">
        {items.map((item, i) => (
          <div
            key={item.label}
            className="flex flex-col items-center px-3 py-3.5 text-center opacity-0 animate-fade-in-up"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'forwards' }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-white/60">{item.icon}</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-none">
              <AnimatedCounter target={item.formatted} />
            </div>
            <div className="mt-1 text-[10px] font-medium text-white/70 uppercase tracking-wider">
              {item.label}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px]">
              {item.trend > 0 ? (
                <span className="text-emerald-300">
                  ↑{item.trend}% {item.trendLabel}
                </span>
              ) : item.trend < 0 ? (
                <span className="text-red-300">
                  ↓{Math.abs(item.trend)}% {item.trendLabel}
                </span>
              ) : (
                <span className="text-white/50">
                  — {item.trendLabel}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
