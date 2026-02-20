'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Database,
  Globe,
  ShieldCheck,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  BarChart3,
  GitCompare,
  FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAnalyticsSummary, type TimeRange } from '@/lib/api/hooks';
import { KpiCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
];

const QUICK_LINKS = [
  {
    href: '/analytics/trends',
    title: 'Trends Analysis',
    description: 'Multi-line time series across all domains',
    icon: <TrendingUp className="h-5 w-5 text-[#1B5E20]" />,
  },
  {
    href: '/analytics/comparison',
    title: 'Country Comparison',
    description: 'Compare metrics across Member States',
    icon: <GitCompare className="h-5 w-5 text-[#006064]" />,
  },
  {
    href: '/analytics/quality',
    title: 'Quality Drill-down',
    description: 'Quality gates pass rates by domain',
    icon: <ShieldCheck className="h-5 w-5 text-[#E65100]" />,
  },
  {
    href: '/analytics/export',
    title: 'Export Builder',
    description: 'Build and download custom data exports',
    icon: <FileDown className="h-5 w-5 text-[#1B5E20]" />,
  },
];

function formatTrend(val: number): { direction: 'up' | 'down' | 'neutral'; value: string } {
  if (val > 0) return { direction: 'up', value: `+${val}%` };
  if (val < 0) return { direction: 'down', value: `${val}%` };
  return { direction: 'neutral', value: '0%' };
}

export default function AnalyticsDashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const { data, isLoading } = useAnalyticsSummary(timeRange);

  const summary = data?.data;

  return (
    <div className="space-y-6">
      {/* Header + Time Range Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Continental data overview, trends, and quality metrics
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.value}
              onClick={() => setTimeRange(tr.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                timeRange === tr.value
                  ? 'bg-[#1B5E20] text-white'
                  : 'text-gray-600 hover:bg-gray-100',
              )}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Records */}
          <div className="rounded-card border border-[#1B5E20]/20 bg-[#1B5E20]/5 p-card shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-kpi-label uppercase tracking-wider text-gray-500">
                Total Records
              </span>
              <Database className="h-5 w-5 text-[#1B5E20]" />
            </div>
            <div className="mt-2 text-kpi text-gray-900">
              {summary.totalRecords.toLocaleString()}
            </div>
            <TrendIndicator
              trend={formatTrend(summary.recordsTrend)}
              label="vs prev. period"
            />
          </div>

          {/* Countries Reporting */}
          <div className="rounded-card border border-[#006064]/20 bg-[#006064]/5 p-card shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-kpi-label uppercase tracking-wider text-gray-500">
                Countries Reporting
              </span>
              <Globe className="h-5 w-5 text-[#006064]" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-kpi text-gray-900">
                {summary.countriesReporting}
              </span>
              <span className="text-sm text-gray-500">/ 55</span>
            </div>
            <TrendIndicator
              trend={formatTrend(summary.countriesTrend)}
              label="new this period"
            />
          </div>

          {/* Avg Quality Score */}
          <div className="rounded-card border border-gray-200 bg-white p-card shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-kpi-label uppercase tracking-wider text-gray-500">
                Avg Quality Score
              </span>
              <ShieldCheck className="h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-kpi text-gray-900">
                {summary.avgQualityScore.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500">%</span>
            </div>
            <TrendIndicator
              trend={formatTrend(summary.qualityTrend)}
              label="vs prev. period"
            />
          </div>

          {/* Pending Exports */}
          <div className="rounded-card border border-[#E65100]/20 bg-[#E65100]/5 p-card shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-kpi-label uppercase tracking-wider text-gray-500">
                Pending Exports
              </span>
              <ArrowUpRight className="h-5 w-5 text-[#E65100]" />
            </div>
            <div className="mt-2 text-kpi text-gray-900">
              {summary.pendingExports}
            </div>
            <div className="mt-3 text-sm text-gray-500">awaiting generation</div>
          </div>
        </div>
      ) : null}

      {/* Domain Breakdown Table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Domain Breakdown
          </h2>
          <Link
            href="/analytics/quality"
            className="flex items-center gap-1 text-xs text-[#1B5E20] hover:underline"
          >
            Quality details <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : (
          <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3 text-right">Records</th>
                  <th className="px-4 py-3">Quality</th>
                  <th className="px-4 py-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(summary?.domainBreakdown ?? []).map((d) => (
                  <tr key={d.domain} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {d.domain}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {d.records.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-full max-w-[120px] rounded-full bg-gray-100 overflow-hidden">
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
                            ? 'bg-green-100 text-green-700'
                            : d.quality >= 90
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700',
                        )}
                      >
                        {d.quality.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {(summary?.domainBreakdown ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      No domain data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Explore Analytics
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-start gap-3 rounded-card border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div className="mt-0.5 flex-shrink-0">{link.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 group-hover:text-[#1B5E20]">
                  {link.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {link.description}
                </p>
              </div>
              <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrendIndicator({
  trend,
  label,
}: {
  trend: { direction: 'up' | 'down' | 'neutral'; value: string };
  label: string;
}) {
  return (
    <div
      className={cn(
        'mt-3 flex items-center gap-1 text-sm',
        trend.direction === 'up'
          ? 'text-green-700'
          : trend.direction === 'down'
            ? 'text-red-700'
            : 'text-gray-500',
      )}
    >
      {trend.direction === 'up' && <TrendingUp className="h-3.5 w-3.5" />}
      {trend.direction === 'down' && <TrendingDown className="h-3.5 w-3.5" />}
      <span className="font-medium">{trend.value}</span>
      <span className="text-gray-500">{label}</span>
    </div>
  );
}
