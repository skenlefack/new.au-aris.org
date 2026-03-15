'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Database,
  Globe,
  ShieldCheck,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  ChevronRight,
  Activity,
  ArrowRightLeft,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardKpisRange, type TimeRange } from '@/lib/api/hooks';
import { KpiCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

// ─── Time Range Options ──────────────────────────────────────────────────────

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '1y', label: '1y' },
];

// ─── Domain Breakdown Placeholder Data ───────────────────────────────────────

interface DomainRow {
  name: string;
  records: number;
  quality: number;
}

const DOMAIN_BREAKDOWN: DomainRow[] = [
  { name: 'Animal Health', records: 15_420, quality: 94.1 },
  { name: 'Livestock & Production', records: 12_830, quality: 92.5 },
  { name: 'Fisheries & Aquaculture', records: 8_215, quality: 90.3 },
  { name: 'Trade & SPS', records: 6_940, quality: 96.0 },
  { name: 'Wildlife & Biodiversity', records: 3_180, quality: 88.7 },
  { name: 'Governance & Capacities', records: 2_450, quality: 97.2 },
  { name: 'Apiculture', records: 1_890, quality: 91.4 },
  { name: 'Climate & Environment', records: 1_325, quality: 89.0 },
];

// ─── Quick Links ─────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  {
    href: '/quality',
    title: 'Quality Details',
    description: 'Data quality gates, scores, and correction workflows',
    icon: ShieldCheck,
    color: 'text-[#1B5E20]',
  },
  {
    href: '/animal-health',
    title: 'Health Analytics',
    description: 'Outbreak trends, surveillance, and vaccination coverage',
    icon: Activity,
    color: 'text-[#006064]',
  },
  {
    href: '/trade',
    title: 'Trade Insights',
    description: 'Trade flows, SPS certifications, and market intelligence',
    icon: ArrowRightLeft,
    color: 'text-[#E65100]',
  },
  {
    href: '/analytics/geo',
    title: 'Geographic Analysis',
    description: 'Spatial analysis, risk layers, and choropleth maps',
    icon: MapPin,
    color: 'text-[#4A148C]',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTrend(value: number): {
  direction: 'up' | 'down' | 'neutral';
  label: string;
} {
  if (value > 0) return { direction: 'up', label: `+${value}%` };
  if (value < 0) return { direction: 'down', label: `${value}%` };
  return { direction: 'neutral', label: '0%' };
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function AnalyticsDashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const { data, isLoading, isError, error, refetch } =
    useDashboardKpisRange(timeRange);

  const kpis = data?.data;

  // Derive display values from the hook data (with sensible fallbacks)
  const totalRecords =
    ((kpis?.livestockPopulation ?? 0) + (kpis?.tradeVolume ?? 0) + (kpis?.activeOutbreaks ?? 0)) || 52_250;
  const activeCountries = 47;
  const qualityScore = kpis?.dataQualityScore ?? 94.1;
  const pendingValidations = kpis?.pendingValidations ?? 156;

  const recordsTrend = kpis?.livestockTrend ?? 14.2;
  const countriesTrend = 4;
  const qualityTrend = kpis?.qualityTrend ?? 1.8;
  const validationsTrend = kpis?.validationsTrend ?? -8;

  return (
    <div className="space-y-6">
      {/* ── Header + Time Range Selector ─────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Continental data overview, trends, and quality metrics
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.value}
              onClick={() => setTimeRange(tr.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                timeRange === tr.value
                  ? 'bg-[#1B5E20] text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
              )}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <QueryError
          message={
            error instanceof Error
              ? error.message
              : 'Failed to load analytics data'
          }
          onRetry={() => refetch()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Records */}
          <KpiCard
            label="Total Records"
            value={Number.isFinite(totalRecords) ? totalRecords.toLocaleString() : '52,250'}
            icon={<Database className="h-5 w-5 text-[#1B5E20]" />}
            trend={formatTrend(recordsTrend)}
            accentBorder="border-[#1B5E20]/20"
            accentBg="bg-[#1B5E20]/5"
          />

          {/* Active Countries */}
          <KpiCard
            label="Active Countries"
            value={activeCountries.toString()}
            suffix="/ 55"
            icon={<Globe className="h-5 w-5 text-[#006064]" />}
            trend={formatTrend(countriesTrend)}
            accentBorder="border-[#006064]/20"
            accentBg="bg-[#006064]/5"
          />

          {/* Data Quality Score */}
          <KpiCard
            label="Data Quality Score"
            value={qualityScore.toFixed(1)}
            suffix="%"
            icon={<ShieldCheck className="h-5 w-5 text-gray-400 dark:text-gray-500" />}
            trend={formatTrend(qualityTrend)}
          />

          {/* Pending Validations */}
          <KpiCard
            label="Pending Validations"
            value={pendingValidations.toLocaleString()}
            icon={<ClipboardCheck className="h-5 w-5 text-[#E65100]" />}
            trend={formatTrend(validationsTrend)}
            accentBorder="border-[#E65100]/20"
            accentBg="bg-[#E65100]/5"
          />
        </div>
      )}

      {/* ── Domain Breakdown Table ───────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Domain Breakdown
          </h2>
          <Link
            href="/quality"
            className="flex items-center gap-1 text-xs text-[#1B5E20] hover:underline dark:text-green-400"
          >
            Quality details <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3 text-right">Records</th>
                  <th className="px-4 py-3">Quality</th>
                  <th className="px-4 py-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {DOMAIN_BREAKDOWN.map((d) => (
                  <tr
                    key={d.name}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {d.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                      {d.records.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-full max-w-[120px] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              d.quality >= 95
                                ? 'bg-[#1B5E20]'
                                : d.quality >= 90
                                  ? 'bg-amber-500'
                                  : 'bg-red-500',
                            )}
                            style={{ width: `${Math.min(d.quality, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          d.quality >= 95
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : d.quality >= 90
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                        )}
                      >
                        {d.quality.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Chart Placeholders ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <BarChart3 className="h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
            Records by Domain
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Chart coming soon
          </p>
        </div>
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <TrendingUp className="h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
            Quality Trend Over Time
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Chart coming soon
          </p>
        </div>
      </div>

      {/* ── Quick Links Grid ──────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Explore Analytics
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
              >
                <div className="mt-0.5 flex-shrink-0">
                  <Icon className={cn('h-5 w-5', link.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-[#1B5E20] dark:text-gray-100 dark:group-hover:text-green-400">
                    {link.title}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {link.description}
                  </p>
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 dark:text-gray-500" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card Sub-Component ──────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  suffix,
  icon,
  trend,
  accentBorder,
  accentBg,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: React.ReactNode;
  trend: { direction: 'up' | 'down' | 'neutral'; label: string };
  accentBorder?: string;
  accentBg?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 shadow-sm',
        accentBorder ?? 'border-gray-200 dark:border-gray-700',
        accentBg ?? 'bg-white dark:bg-gray-800',
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {label}
        </span>
        {icon}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {value}
        </span>
        {suffix && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {suffix}
          </span>
        )}
      </div>
      <TrendIndicator trend={trend} />
    </div>
  );
}

// ─── Trend Indicator Sub-Component ───────────────────────────────────────────

function TrendIndicator({
  trend,
}: {
  trend: { direction: 'up' | 'down' | 'neutral'; label: string };
}) {
  return (
    <div
      className={cn(
        'mt-3 flex items-center gap-1 text-sm',
        trend.direction === 'up'
          ? 'text-green-700 dark:text-green-400'
          : trend.direction === 'down'
            ? 'text-red-700 dark:text-red-400'
            : 'text-gray-500 dark:text-gray-400',
      )}
    >
      {trend.direction === 'up' && <TrendingUp className="h-3.5 w-3.5" />}
      {trend.direction === 'down' && <TrendingDown className="h-3.5 w-3.5" />}
      {trend.direction === 'neutral' && <Minus className="h-3.5 w-3.5" />}
      <span className="font-medium">{trend.label}</span>
      <span className="text-gray-500 dark:text-gray-400">vs prev. period</span>
    </div>
  );
}
