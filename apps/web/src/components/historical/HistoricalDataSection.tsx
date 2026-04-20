'use client';

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  useHistoricalDatasets,
  useCrossTimeSeries,
  useCrossAggregate,
  useDashboardKpis,
  useDiseaseNameMap,
  resolveDiseaseLabel,
} from '@/lib/api/historical-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const COLORS = ['#2e75b6', '#e67e22', '#27ae60', '#c0392b', '#8e44ad', '#16a085', '#d35400', '#f39c12'];

const DOMAIN_LABELS: Record<string, string> = {
  animal_health: 'Animal Health',
  livestock: 'Livestock',
  trade_sps: 'Trade & SPS',
  fisheries: 'Fisheries',
  governance: 'Governance',
};

interface Props {
  domain: string;
  maxDiseases?: number;
}

export function HistoricalDataSection({ domain, maxDiseases = 8 }: Props) {
  const { accessToken } = useAuthStore();
  const { data: dsRes, isLoading: dsLoading, isError: dsError } = useHistoricalDatasets({ limit: 100, domain, status: 'READY' });
  const datasets = dsRes?.data ?? [];
  const datasetIds = useMemo(() => datasets.map((d) => d.id), [datasets]);
  const totalRows = datasets.reduce((s, d) => s + d.rowCount, 0);

  const kpis = useDashboardKpis({ year: new Date().getFullYear() - 1, datasetIds });
  const { data: diseaseMap } = useDiseaseNameMap();
  const epiCurve = useCrossTimeSeries();
  const topItems = useCrossAggregate();

  useEffect(() => {
    if (datasetIds.length === 0) return;

    epiCurve.mutate({
      datasetIds,
      dateColumn: 'date_of_report',
      valueColumn: 'num_new_outbreaks',
      interval: 'year',
      operation: 'count',
    });

    const col = domain === 'trade_sps' ? 'activity' : 'disease';
    topItems.mutate({
      datasetIds,
      column: col,
      operation: 'distribution',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetIds.length]);

  if (!accessToken) return null;
  if (dsLoading) {
    return (
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          <div>
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-1 h-3 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      </div>
    );
  }
  if (dsError || datasets.length === 0) return null;

  const kpiData = kpis.data?.data;
  const curveData = (epiCurve.data?.data as any[] ?? [])
    .filter((d: any) => d.period && String(d.period).startsWith('20'))
    .map((d: any) => ({ year: new Date(d.period).getFullYear(), value: Number(d.value) || 0 }));

  const topData = (topItems.data?.data as any[] ?? [])
    .filter((d: any) => d.label && d.value > 0)
    .slice(0, maxDiseases);

  const pieData = topData.map((d: any, i: number) => ({
    name: resolveDiseaseLabel(String(d.label), diseaseMap).slice(0, 22),
    value: Number(d.value),
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className="mt-8 space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
            <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Historical Data
            </h2>
            <p className="text-xs text-slate-500">
              {datasets.length} datasets, {totalRows.toLocaleString()} records (2008-2025)
            </p>
          </div>
        </div>
        <Link
          href="/historical/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/5 transition-colors"
        >
          Full Dashboard
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>

      {/* KPIs Row */}
      {kpiData && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniKpi label="Reports" value={kpiData.totalReports} change={kpiData.pctChangeReports} />
          <MiniKpi label="Outbreaks" value={kpiData.totalOutbreaks} change={kpiData.pctChangeOutbreaks} />
          <MiniKpi label="Diseases" value={kpiData.uniqueDiseases} change={kpiData.pctChangeDiseases} />
          <MiniKpi label="Locations" value={kpiData.uniqueLocations} change={kpiData.pctChangeLocations} />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Epidemic Curve (mini) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Trend (2008-2025)
          </h3>
          <div className="h-[180px]">
            {curveData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curveData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`grad-${domain}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2e75b6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2e75b6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={45} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 11 }}
                    formatter={(v: number) => [v.toLocaleString(), 'Reports']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#2e75b6" strokeWidth={2} fill={`url(#grad-${domain})`} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : epiCurve.isPending ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-accent)]" />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">No time series data</div>
            )}
          </div>
        </div>

        {/* Top Items (Pie + list) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {domain === 'trade_sps' ? 'Top Activities' : 'Top Diseases'}
          </h3>
          <div className="h-[180px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    innerRadius={35}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 11 }}
                    formatter={(v: number) => [v.toLocaleString(), 'Reports']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : topItems.isPending ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-accent)]" />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">No data</div>
            )}
          </div>
          {/* Legend */}
          {pieData.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {pieData.slice(0, 5).map((d, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: d.fill }} />
                  <span className="text-[10px] text-slate-500">{d.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dataset Links */}
      <div className="flex flex-wrap gap-2">
        {datasets.slice(0, 5).map((ds) => (
          <Link
            key={ds.id}
            href={`/historical/${ds.id}`}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
          >
            {ds.name.slice(0, 40)}
            <span className="ml-1 text-slate-400">({ds.rowCount.toLocaleString()})</span>
          </Link>
        ))}
        {datasets.length > 5 && (
          <Link href="/historical" className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-400 hover:text-[var(--color-accent)]">
            +{datasets.length - 5} more
          </Link>
        )}
      </div>
    </div>
  );
}

function MiniKpi({ label, value, change }: { label: string; value: number; change: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/50">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-white">{value.toLocaleString()}</p>
      <p className="text-[10px]">
        {change > 0 && <span className="text-red-500">+{change}%</span>}
        {change < 0 && <span className="text-emerald-500">{change}%</span>}
        {change === 0 && <span className="text-slate-400">0%</span>}
        <span className="ml-1 text-slate-400">vs prev yr</span>
      </p>
    </div>
  );
}
