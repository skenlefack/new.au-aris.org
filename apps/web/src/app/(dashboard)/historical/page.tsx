'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  useHistoricalDatasets,
  useHistoricalStats,
  useDeleteDataset,
  type HistoricalDataset,
} from '@/lib/api/historical-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';

/* ------------------------------------------------------------------ */
/*  Status badge                                                        */
/* ------------------------------------------------------------------ */

const STATUS_COLORS: Record<string, string> = {
  READY: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  IMPORTING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ANALYZING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PENDING: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ARCHIVED: 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? STATUS_COLORS['PENDING']}`}>
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

const DOMAIN_LABELS: Record<string, string> = {
  animal_health: 'Animal Health',
  livestock: 'Livestock',
  fisheries: 'Fisheries',
  trade: 'Trade & SPS',
  wildlife: 'Wildlife',
  apiculture: 'Apiculture',
  governance: 'Governance',
  climate: 'Climate & Env',
  general: 'General',
};

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function HistoricalDataPage() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('');
  const [page, setPage] = useState(1);

  const { data: statsResponse } = useHistoricalStats();
  const { data: datasetsResponse, isLoading } = useHistoricalDatasets({
    page,
    limit: 20,
    domain: domain || undefined,
    search: search || undefined,
  });
  const deleteDataset = useDeleteDataset();

  const stats = statsResponse?.data;
  const datasets = datasetsResponse?.data ?? [];
  const meta = datasetsResponse?.meta;

  const canImport = user && ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN', 'DATA_STEWARD'].includes(user.role);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete dataset "${name}"? This will permanently remove the data.`)) return;
    deleteDataset.mutate(id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Historical Data</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Import and analyze historical datasets from files (Excel, CSV, JSON)
          </p>
        </div>
        {canImport && (
          <Link
            href="/historical/import"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Import Dataset
          </Link>
        )}
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Datasets" value={formatNumber(stats.totalDatasets)} />
          <StatCard label="Total Rows" value={formatNumber(stats.totalRows)} />
          <StatCard
            label="Ready"
            value={formatNumber(stats.byStatus.find((s) => s.status === 'READY')?.count ?? 0)}
          />
          <StatCard label="Domains" value={String(stats.byDomain.length)} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search datasets..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
        />
        <select
          value={domain}
          onChange={(e) => { setDomain(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">All domains</option>
          {Object.entries(DOMAIN_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Dataset table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">Loading datasets...</div>
      ) : datasets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-slate-500 dark:text-slate-400">No datasets found</p>
          {canImport && (
            <Link
              href="/historical/import"
              className="mt-3 text-sm text-[var(--color-accent)] hover:underline"
            >
              Import your first dataset
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Name</th>
                <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Domain</th>
                <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Type</th>
                <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300 text-right">Rows</th>
                <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300 text-right">Cols</th>
                <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300 text-right">Size</th>
                <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Status</th>
                <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {datasets.map((ds: HistoricalDataset) => (
                <tr key={ds.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <Link href={`/historical/${ds.id}`} className="font-medium text-slate-900 dark:text-white hover:text-[var(--color-accent)]">
                      {ds.name}
                    </Link>
                    {ds.description && (
                      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]">
                        {ds.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {DOMAIN_LABELS[ds.domain] ?? ds.domain}
                  </td>
                  <td className="px-4 py-3 uppercase text-xs font-mono text-slate-500">{ds.fileType}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatNumber(ds.rowCount)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{ds.columnCount}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{formatBytes(ds.fileSizeBytes)}</td>
                  <td className="px-4 py-3"><StatusBadge status={ds.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(ds.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/historical/${ds.id}`}
                        className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                        title="View"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      {canImport && (
                        <button
                          onClick={() => handleDelete(ds.id, ds.name)}
                          className="rounded p-1 text-slate-400 hover:text-red-500"
                          title="Delete"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total > meta.limit && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {formatNumber(meta.total)}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Previous
            </button>
            <button
              disabled={page * meta.limit >= meta.total}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                           */
/* ------------------------------------------------------------------ */

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
