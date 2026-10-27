'use client';

import React, { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMdmChartData } from '@/lib/api/mdm-hooks';
import { useTranslations } from '@/lib/i18n/translations';

// ── Horizontal Bar Chart ──

function HorizontalBarChart({
  labels,
  values,
  colors,
}: {
  labels: string[];
  values: number[];
  colors: string[];
}) {
  const max = Math.max(...values, 1);
  return (
    <div className="space-y-2">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-28 text-xs text-gray-500 text-right truncate">{label}</span>
          <div className="flex-1 h-5 rounded bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
            <div
              className={cn('h-full rounded', colors[i % colors.length])}
              style={{ width: `${(values[i] / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-xs text-gray-500 text-right">{values[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Chart Card Wrapper ──

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ── Color Palettes ──

const OS_COLORS = [
  'bg-blue-500', 'bg-teal-500', 'bg-blue-400', 'bg-teal-400',
  'bg-blue-300', 'bg-teal-300', 'bg-blue-600', 'bg-teal-600',
];

const NETWORK_COLOR_MAP: Record<string, string> = {
  WIFI: 'bg-emerald-500',
  CELLULAR: 'bg-blue-500',
  ETHERNET: 'bg-amber-500',
};
const NETWORK_DEFAULT = 'bg-gray-400';

const COMPLIANCE_COLOR_MAP: Record<string, string> = {
  Compliant: 'bg-emerald-500',
  'Non-Compliant': 'bg-red-500',
  Unknown: 'bg-gray-400',
  COMPLIANT: 'bg-emerald-500',
  NON_COMPLIANT: 'bg-red-500',
  UNKNOWN: 'bg-gray-400',
};

// ── Helpers ──

function extractChartEntries(raw: any): { labels: string[]; values: number[] } {
  // Accept various shapes: { items: [{label,value}] } | { data: [{key,count}] } | [{label,value}]
  const arr = raw?.items ?? raw?.data ?? raw?.buckets ?? (Array.isArray(raw) ? raw : []);
  const labels: string[] = [];
  const values: number[] = [];
  for (const item of arr) {
    labels.push(item.label ?? item.key ?? item.name ?? 'Unknown');
    values.push(item.value ?? item.count ?? 0);
  }
  return { labels, values };
}

// ── Main Component ──

export function AnalyticsTab() {
  const t = useTranslations('mdm');
  const { data: osRaw, isLoading: osLoading } = useMdmChartData('os-versions');
  const { data: networkRaw, isLoading: netLoading } = useMdmChartData('network-types');
  const { data: complianceRaw, isLoading: compLoading } = useMdmChartData('compliance-status');

  const osChart = useMemo(() => {
    const inner = (osRaw as any)?.data ?? osRaw;
    return extractChartEntries(inner);
  }, [osRaw]);

  const networkChart = useMemo(() => {
    const inner = (networkRaw as any)?.data ?? networkRaw;
    return extractChartEntries(inner);
  }, [networkRaw]);

  const complianceChart = useMemo(() => {
    const inner = (complianceRaw as any)?.data ?? complianceRaw;
    return extractChartEntries(inner);
  }, [complianceRaw]);

  const networkColors = networkChart.labels.map(
    (l) => NETWORK_COLOR_MAP[l.toUpperCase()] ?? NETWORK_DEFAULT,
  );

  const complianceColors = complianceChart.labels.map(
    (l) => COMPLIANCE_COLOR_MAP[l] ?? COMPLIANCE_COLOR_MAP[l.toUpperCase()] ?? 'bg-gray-400',
  );

  const isLoading = osLoading && netLoading && compLoading;
  const isEmpty =
    osChart.labels.length === 0 &&
    networkChart.labels.length === 0 &&
    complianceChart.labels.length === 0;

  if (isLoading || isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
          <BarChart3 className="h-8 w-8" />
        </div>
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
          {isLoading
            ? (t('loadingAnalytics') ?? 'Loading analytics...')
            : (t('noAnalyticsData') ?? 'No analytics data yet')}
        </h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs text-center">
          {isLoading
            ? ''
            : 'Analytics charts will appear once devices start reporting data.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* OS Versions */}
      {osChart.labels.length > 0 && (
        <ChartCard title={t('osVersions') ?? 'OS Versions'}>
          <HorizontalBarChart
            labels={osChart.labels}
            values={osChart.values}
            colors={OS_COLORS}
          />
        </ChartCard>
      )}

      {/* Network Types */}
      {networkChart.labels.length > 0 && (
        <ChartCard title={t('networkTypes') ?? 'Network Types'}>
          <HorizontalBarChart
            labels={networkChart.labels}
            values={networkChart.values}
            colors={networkColors}
          />
        </ChartCard>
      )}

      {/* Compliance Status */}
      {complianceChart.labels.length > 0 && (
        <ChartCard title={t('complianceStatus') ?? 'Compliance Status'}>
          <HorizontalBarChart
            labels={complianceChart.labels}
            values={complianceChart.values}
            colors={complianceColors}
          />
        </ChartCard>
      )}
    </div>
  );
}
