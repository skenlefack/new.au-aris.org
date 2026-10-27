'use client';

import React, { useMemo } from 'react';
import {
  Smartphone, Wifi, WifiOff, BatteryWarning, AlertTriangle,
  Shield, ShieldAlert, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMdmStats, useMdmChartData } from '@/lib/api/mdm-hooks';
import { useTranslations } from '@/lib/i18n/translations';

// ── KPI Card ──

function KpiCard({ label, value, icon: Icon, bgColor, textColor }: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  bgColor: string;
  textColor: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', bgColor)}>
          <Icon className={cn('h-5 w-5', textColor)} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ── SVG Donut Chart ──

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

function DonutChart({ segments, title }: { segments: DonutSegment[]; title: string }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = 15.915;
  const circumference = 100; // stroke-dasharray uses percentage when viewBox is 36x36

  let cumulativeOffset = 0;
  const arcs = segments.map((seg) => {
    const pct = (seg.value / total) * circumference;
    const arc = { ...seg, pct, offset: cumulativeOffset };
    cumulativeOffset += pct;
    return arc;
  });

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h3>
      <div className="flex items-center justify-center gap-8">
        <svg viewBox="0 0 36 36" className="h-36 w-36">
          <circle cx="18" cy="18" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" className="dark:stroke-gray-700" />
          {arcs.map((arc) =>
            arc.pct > 0 ? (
              <circle
                key={arc.label}
                cx="18"
                cy="18"
                r={r}
                fill="none"
                stroke={arc.color}
                strokeWidth="3"
                strokeDasharray={`${arc.pct} ${circumference - arc.pct}`}
                strokeDashoffset={`${-arc.offset}`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            ) : null,
          )}
          <text x="18" y="17" textAnchor="middle" className="fill-gray-800 dark:fill-white text-[6px] font-semibold">
            {total}
          </text>
          <text x="18" y="22" textAnchor="middle" className="fill-gray-400 text-[3px]">
            devices
          </text>
        </svg>
        <div className="space-y-2">
          {arcs.map((seg) => (
            <div key={seg.label} className="flex items-center gap-2 text-xs">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-gray-600 dark:text-gray-400">{seg.label}</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200 ml-auto">{seg.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── SVG Horizontal Bar Chart ──

interface BarEntry {
  label: string;
  value: number;
  color: string;
}

function HorizontalBarChartCard({ entries, title }: { entries: BarEntry[]; title: string }) {
  const max = Math.max(...entries.map((e) => e.value), 1);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h3>
      <div className="space-y-3">
        {entries.map((entry) => (
          <div key={entry.label} className="flex items-center gap-3">
            <span className="w-24 text-xs text-gray-500 text-right truncate">{entry.label}</span>
            <div className="flex-1 h-5 rounded bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{ width: `${(entry.value / max) * 100}%`, backgroundColor: entry.color }}
              />
            </div>
            <span className="w-10 text-xs text-gray-500 text-right">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ──

export function OverviewTab() {
  const t = useTranslations('mdm');
  const { data: statsRaw } = useMdmStats();
  const { data: statusChartRaw } = useMdmChartData('device-status');
  const { data: batteryChartRaw } = useMdmChartData('battery-distribution');

  // Normalize stats — backend may return nested or flat
  const stats = useMemo(() => {
    const s = (statsRaw as any)?.data ?? statsRaw ?? {};
    return {
      totalDevices: s.totalDevices ?? s.total ?? 0,
      online: s.online ?? 0,
      offline: s.offline ?? 0,
      lowBattery: s.lowBattery ?? 0,
      activeAlerts: s.activeAlerts ?? 0,
      compliant: s.compliant ?? 0,
      nonCompliant: s.nonCompliant ?? 0,
      pendingEnrollment: s.pendingEnrollment ?? 0,
    };
  }, [statsRaw]);

  // Donut segments from chart data or stats fallback
  const donutSegments = useMemo<DonutSegment[]>(() => {
    const raw = (statusChartRaw as any)?.data ?? statusChartRaw;
    if (raw?.segments && Array.isArray(raw.segments)) {
      const colorMap: Record<string, string> = {
        online: '#10b981', idle: '#3b82f6', offline: '#ef4444', inactive: '#9ca3af',
      };
      return raw.segments.map((s: any) => ({
        label: s.label ?? s.key ?? 'Unknown',
        value: s.value ?? s.count ?? 0,
        color: colorMap[(s.key ?? s.label ?? '').toLowerCase()] ?? '#9ca3af',
      }));
    }
    // Fallback from stats
    const idle = Math.max(0, stats.totalDevices - stats.online - stats.offline);
    return [
      { label: t('online'), value: stats.online, color: '#10b981' },
      { label: t('idle') ?? 'Idle', value: idle, color: '#3b82f6' },
      { label: t('offline'), value: stats.offline, color: '#ef4444' },
    ];
  }, [statusChartRaw, stats, t]);

  // Battery distribution bars
  const batteryEntries = useMemo<BarEntry[]>(() => {
    const raw = (batteryChartRaw as any)?.data ?? batteryChartRaw;
    if (raw?.buckets && Array.isArray(raw.buckets)) {
      const colorMap: Record<string, string> = {
        'critical': '#ef4444', '0-20': '#ef4444',
        'low': '#f59e0b', '20-40': '#f59e0b',
        'medium': '#eab308', '40-60': '#eab308',
        'good': '#10b981', '60-80': '#10b981',
        'full': '#22c55e', '80-100': '#22c55e',
      };
      return raw.buckets.map((b: any) => ({
        label: b.label ?? b.range ?? 'Unknown',
        value: b.value ?? b.count ?? 0,
        color: colorMap[(b.key ?? b.range ?? b.label ?? '').toLowerCase()] ?? '#9ca3af',
      }));
    }
    // Fallback: show placeholder buckets
    return [
      { label: '0-20%', value: stats.lowBattery, color: '#ef4444' },
      { label: '20-40%', value: 0, color: '#f59e0b' },
      { label: '40-60%', value: 0, color: '#eab308' },
      { label: '60-80%', value: 0, color: '#10b981' },
      { label: '80-100%', value: Math.max(0, stats.totalDevices - stats.lowBattery), color: '#22c55e' },
    ];
  }, [batteryChartRaw, stats]);

  // KPI card definitions
  const kpis = [
    { label: t('totalDevices'), value: stats.totalDevices, icon: Smartphone, bgColor: 'bg-slate-100 dark:bg-slate-500/10', textColor: 'text-slate-600 dark:text-slate-400' },
    { label: t('online'), value: stats.online, icon: Wifi, bgColor: 'bg-emerald-100 dark:bg-emerald-500/10', textColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: t('offline'), value: stats.offline, icon: WifiOff, bgColor: 'bg-red-100 dark:bg-red-500/10', textColor: 'text-red-600 dark:text-red-400' },
    { label: t('lowBattery'), value: stats.lowBattery, icon: BatteryWarning, bgColor: 'bg-amber-100 dark:bg-amber-500/10', textColor: 'text-amber-600 dark:text-amber-400' },
    { label: t('activeAlerts'), value: stats.activeAlerts, icon: AlertTriangle, bgColor: 'bg-red-100 dark:bg-red-500/10', textColor: 'text-red-600 dark:text-red-400' },
    { label: t('compliant'), value: stats.compliant, icon: Shield, bgColor: 'bg-emerald-100 dark:bg-emerald-500/10', textColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: t('nonCompliant') ?? 'Non-Compliant', value: stats.nonCompliant, icon: ShieldAlert, bgColor: 'bg-amber-100 dark:bg-amber-500/10', textColor: 'text-amber-600 dark:text-amber-400' },
    { label: t('pendingEnrollment') ?? 'Pending Enrollment', value: stats.pendingEnrollment, icon: Clock, bgColor: 'bg-blue-100 dark:bg-blue-500/10', textColor: 'text-blue-600 dark:text-blue-400' },
  ];

  return (
    <div className="space-y-6">
      {/* 8 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            bgColor={kpi.bgColor}
            textColor={kpi.textColor}
          />
        ))}
      </div>

      {/* 2 Charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DonutChart
          title={t('deviceStatus')}
          segments={donutSegments}
        />
        <HorizontalBarChartCard
          title={t('batteryDistribution') ?? 'Battery Distribution'}
          entries={batteryEntries}
        />
      </div>
    </div>
  );
}
