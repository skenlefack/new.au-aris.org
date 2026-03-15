'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Database,
  Layers,
  CheckCircle2,
  BarChart3,
  Search,
  Filter,
  Upload,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useHistoricalStats,
  useHistoricalDatasets,
  type HistoricalDataset,
} from '@/lib/api/historical-hooks';

/* ------------------------------------------------------------------ */
/*  Domain config                                                       */
/* ------------------------------------------------------------------ */

const DOMAIN_META: Record<string, { label: string; icon: string; accent: string; badge: string }> = {
  animal_health: { label: 'Animal Health', icon: '🏥', accent: 'border-red-300 bg-red-50', badge: 'bg-red-100 text-red-700' },
  livestock:     { label: 'Livestock',     icon: '🐄', accent: 'border-amber-300 bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
  fisheries:     { label: 'Fisheries',     icon: '🐟', accent: 'border-blue-300 bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
  trade:         { label: 'Trade & SPS',   icon: '📦', accent: 'border-purple-300 bg-purple-50', badge: 'bg-purple-100 text-purple-700' },
  wildlife:      { label: 'Wildlife',      icon: '🦁', accent: 'border-green-300 bg-green-50', badge: 'bg-green-100 text-green-700' },
  apiculture:    { label: 'Apiculture',    icon: '🐝', accent: 'border-yellow-300 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700' },
  governance:    { label: 'Governance',    icon: '⚖️', accent: 'border-orange-300 bg-orange-50', badge: 'bg-orange-100 text-orange-700' },
  climate:       { label: 'Climate & Env', icon: '🌍', accent: 'border-teal-300 bg-teal-50', badge: 'bg-teal-100 text-teal-700' },
  general:       { label: 'General',       icon: '📊', accent: 'border-slate-300 bg-slate-50', badge: 'bg-slate-100 text-slate-700' },
};

const STATUS_BADGE: Record<string, string> = {
  READY:     'bg-emerald-100 text-emerald-700',
  IMPORTING: 'bg-amber-100 text-amber-700',
  ANALYZING: 'bg-sky-100 text-sky-700',
  PENDING:   'bg-slate-100 text-slate-600',
  FAILED:    'bg-red-100 text-red-700',
  ARCHIVED:  'bg-gray-100 text-gray-500',
};

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function HistoricalDataPage() {
  const [domainFilter, setDomainFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: statsRes, isLoading: statsLoading } = useHistoricalStats();
  const { data: dsRes, isLoading: dsLoading } = useHistoricalDatasets({
    page,
    limit,
    domain: domainFilter || undefined,
    status: statusFilter || undefined,
    search: searchText || undefined,
  });

  const stats = statsRes?.data;
  const datasets = dsRes?.data ?? [];
  const meta = dsRes?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;

  const readyCount = stats?.byStatus?.find((s) => s.status === 'READY')?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Historical Data</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Imported datasets, time series and versioned records across all domains
          </p>
        </div>
        <Link
          href="/historical/import"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <Upload className="h-4 w-4" />
          Import Dataset
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Datasets"
          value={stats?.totalDatasets ?? 0}
          sub="Across all domains"
          icon={<Database className="h-5 w-5 text-gray-300" />}
          className="border-gray-200 bg-white"
          loading={statsLoading}
        />
        <KpiCard
          label="Total Rows"
          value={stats?.totalRows ?? 0}
          sub="In ready datasets"
          icon={<BarChart3 className="h-5 w-5 text-blue-300" />}
          className="border-blue-200 bg-blue-50"
          labelColor="text-blue-600"
          valueColor="text-blue-700"
          loading={statsLoading}
        />
        <KpiCard
          label="Domains Covered"
          value={stats?.byDomain?.length ?? 0}
          sub="Out of 9 total"
          icon={<Layers className="h-5 w-5 text-[var(--color-accent)]" />}
          className="border-[color:var(--color-accent)]/20 bg-[var(--color-accent)]/5"
          labelColor="text-[var(--color-accent)]"
          valueColor="text-[var(--color-accent)]"
          loading={statsLoading}
        />
        <KpiCard
          label="Ready Datasets"
          value={readyCount}
          sub="Successfully imported"
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-300" />}
          className="border-emerald-200 bg-emerald-50"
          labelColor="text-emerald-600"
          valueColor="text-emerald-700"
          loading={statsLoading}
        />
      </div>

      {/* Domain Breakdown */}
      {stats && stats.byDomain.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            By Domain
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stats.byDomain.map((d) => {
              const dm = DOMAIN_META[d.domain] ?? DOMAIN_META.general!;
              const isActive = domainFilter === d.domain;
              return (
                <button
                  key={d.domain}
                  onClick={() => {
                    setDomainFilter(isActive ? '' : d.domain);
                    setPage(1);
                  }}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                    isActive
                      ? 'ring-2 ring-[var(--color-accent)] border-[var(--color-accent)]'
                      : dm.accent,
                    'hover:shadow-sm',
                  )}
                >
                  <span className="text-2xl">{dm.icon}</span>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{dm.label}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{d.count}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={domainFilter}
            onChange={(e) => { setDomainFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:border-[var(--color-accent)] focus:outline-none"
          >
            <option value="">All Domains</option>
            {Object.entries(DOMAIN_META).map(([key, dm]) => (
              <option key={key} value={key}>{dm.label}</option>
            ))}
          </select>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:border-[var(--color-accent)] focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="READY">Ready</option>
          <option value="IMPORTING">Importing</option>
          <option value="FAILED">Failed</option>
          <option value="ARCHIVED">Archived</option>
        </select>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search datasets..."
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
          />
        </div>
      </div>

      {/* Datasets Table */}
      {dsLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent mr-3" />
          Loading datasets...
        </div>
      ) : datasets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 dark:border-slate-700">
          <FileSpreadsheet className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No datasets found</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {searchText || domainFilter || statusFilter
              ? 'Try adjusting your filters'
              : 'Import your first dataset to get started'}
          </p>
          {!searchText && !domainFilter && !statusFilter && (
            <Link
              href="/historical/import"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Upload className="h-4 w-4" />
              Import Dataset
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800/50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-slate-700 dark:bg-slate-800">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Domain</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Rows</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Columns</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">File Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {datasets.map((ds: HistoricalDataset) => {
                  const dm = DOMAIN_META[ds.domain] ?? DOMAIN_META.general!;
                  return (
                    <tr key={ds.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <Link
                          href={`/historical/${ds.id}`}
                          className="font-medium text-gray-900 hover:text-[var(--color-accent)] dark:text-white"
                        >
                          {ds.name}
                        </Link>
                        {ds.description && (
                          <p className="mt-0.5 text-xs text-gray-400 truncate max-w-[250px]">{ds.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', dm.badge)}>
                          <span>{dm.icon}</span> {dm.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[ds.status] ?? 'bg-gray-100 text-gray-600')}>
                          {ds.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                        {ds.rowCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {ds.columnCount}
                      </td>
                      <td className="px-4 py-3 text-gray-500 uppercase text-xs">
                        {ds.fileType}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(ds.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-gray-500">
              Showing {datasets.length} of {meta?.total ?? 0} datasets
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-gray-600 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KPI card component                                                  */
/* ------------------------------------------------------------------ */

function KpiCard({
  label,
  value,
  sub,
  icon,
  className,
  labelColor = 'text-gray-500',
  valueColor = 'text-gray-900',
  loading,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  className?: string;
  labelColor?: string;
  valueColor?: string;
  loading?: boolean;
}) {
  return (
    <div className={cn('rounded-xl border p-4 shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <span className={cn('text-xs uppercase tracking-wider', labelColor)}>{label}</span>
        {icon}
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-gray-200 dark:bg-slate-700" />
      ) : (
        <p className={cn('mt-2 text-2xl font-bold', valueColor)}>
          {value.toLocaleString()}
        </p>
      )}
      <p className="mt-1 text-xs text-gray-400">{sub}</p>
    </div>
  );
}
