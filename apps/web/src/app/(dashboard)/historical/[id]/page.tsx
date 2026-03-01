'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  useHistoricalDataset,
  useDatasetData,
  useDatasetAnalyses,
  useDeleteDataset,
  useAggregateData,
  type DatasetColumn,
} from '@/lib/api/historical-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';

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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

type Tab = 'data' | 'columns' | 'charts' | 'analyses';

export default function DatasetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuthStore();

  const [tab, setTab] = useState<Tab>('data');
  const [dataPage, setDataPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data: dsResponse, isLoading: dsLoading } = useHistoricalDataset(id);
  const { data: dataResponse, isLoading: dataLoading } = useDatasetData(id, {
    page: dataPage,
    limit: 50,
    search: search || undefined,
  });
  const { data: analysesResponse } = useDatasetAnalyses(id);
  const deleteDataset = useDeleteDataset();
  const aggregate = useAggregateData();

  const dataset = dsResponse?.data;
  const rows = dataResponse?.data ?? [];
  const dataMeta = dataResponse?.meta;
  const analyses = analysesResponse?.data ?? [];

  const canManage = user && ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN'].includes(user.role);

  if (dsLoading) {
    return <div className="flex items-center justify-center py-20 text-slate-400">Loading dataset...</div>;
  }

  if (!dataset) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-slate-500">Dataset not found</p>
        <Link href="/historical" className="mt-3 text-sm text-[var(--color-accent)] hover:underline">Back to datasets</Link>
      </div>
    );
  }

  const columns = dataset.columns ?? [];

  const handleDelete = async () => {
    if (!confirm(`Delete dataset "${dataset.name}"? This cannot be undone.`)) return;
    await deleteDataset.mutateAsync(id);
    router.push('/historical');
  };

  const handleAggregateColumn = (col: DatasetColumn) => {
    const op = col.dataType === 'INTEGER' || col.dataType === 'FLOAT' ? 'sum' : 'distribution';
    aggregate.mutate({ datasetId: id, column: col.pgColumnName, operation: op });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/historical" className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{dataset.name}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              dataset.status === 'READY'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            }`}>
              {dataset.status}
            </span>
          </div>
          {dataset.description && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{dataset.description}</p>
          )}
        </div>
        {canManage && (
          <button
            onClick={handleDelete}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Delete
          </button>
        )}
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        <MetaItem label="Domain" value={DOMAIN_LABELS[dataset.domain] ?? dataset.domain} />
        <MetaItem label="File Type" value={dataset.fileType.toUpperCase()} />
        <MetaItem label="Rows" value={dataset.rowCount.toLocaleString()} />
        <MetaItem label="Columns" value={String(dataset.columnCount)} />
        <MetaItem label="Size" value={formatBytes(dataset.fileSizeBytes)} />
        <MetaItem label="Imported" value={new Date(dataset.created_at).toLocaleDateString()} />
      </div>

      {/* Tags */}
      {dataset.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dataset.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {([
          { key: 'data', label: 'Data' },
          { key: 'columns', label: `Columns (${columns.length})` },
          { key: 'charts', label: 'Quick Charts' },
          { key: 'analyses', label: `Analyses (${analyses.length})` },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content: Data */}
      {tab === 'data' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search data..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setDataPage(1); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
            />
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">Loading data...</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-slate-400">No data found</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-3 py-2 font-medium text-slate-500">#</th>
                    {columns.slice(0, 10).map((col) => (
                      <th key={col.id} className="px-3 py-2 font-medium text-slate-500 whitespace-nowrap">{col.name}</th>
                    ))}
                    {columns.length > 10 && <th className="px-3 py-2 text-slate-400">+{columns.length - 10} more</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {rows.map((row: any, ri: number) => (
                    <tr key={ri} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-3 py-1.5 text-slate-400">{row._row_id ?? (dataPage - 1) * 50 + ri + 1}</td>
                      {columns.slice(0, 10).map((col) => (
                        <td key={col.id} className="px-3 py-1.5 text-slate-600 dark:text-slate-300 whitespace-nowrap max-w-[200px] truncate">
                          {String(row[col.pgColumnName] ?? '')}
                        </td>
                      ))}
                      {columns.length > 10 && <td className="px-3 py-1.5 text-slate-400">...</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {dataMeta && dataMeta.total > dataMeta.limit && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                {(dataMeta.page - 1) * dataMeta.limit + 1}–{Math.min(dataMeta.page * dataMeta.limit, dataMeta.total)} of {dataMeta.total.toLocaleString()}
              </span>
              <div className="flex gap-2">
                <button disabled={dataPage <= 1} onClick={() => setDataPage(dataPage - 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-40 dark:border-slate-700">Prev</button>
                <button disabled={dataPage * dataMeta.limit >= dataMeta.total} onClick={() => setDataPage(dataPage + 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-40 dark:border-slate-700">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab content: Columns */}
      {tab === 'columns' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-500">#</th>
                <th className="px-4 py-3 font-medium text-slate-500">Name</th>
                <th className="px-4 py-3 font-medium text-slate-500">PG Column</th>
                <th className="px-4 py-3 font-medium text-slate-500">Type</th>
                <th className="px-4 py-3 font-medium text-slate-500">Nullable</th>
                <th className="px-4 py-3 font-medium text-slate-500">Unique Values</th>
                <th className="px-4 py-3 font-medium text-slate-500">Nulls</th>
                <th className="px-4 py-3 font-medium text-slate-500">Range</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {columns.map((col) => (
                <tr key={col.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-2.5 text-slate-400">{col.ordinal + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">{col.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{col.pgColumnName}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono dark:bg-slate-700">{col.dataType}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{col.nullable ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{col.stats?.uniqueCount ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{col.stats?.nullCount ?? 0}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {col.stats?.min !== undefined && col.stats?.max !== undefined
                      ? `${col.stats.min} → ${col.stats.max}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab content: Charts */}
      {tab === 'charts' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Click a column to generate a quick aggregation chart.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {columns.map((col) => (
              <button
                key={col.id}
                onClick={() => handleAggregateColumn(col)}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-[var(--color-accent)] dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-[var(--color-accent)]"
              >
                <span className="rounded bg-slate-100 px-2 py-1 text-xs font-mono dark:bg-slate-700">{col.dataType}</span>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{col.name}</p>
                  <p className="text-xs text-slate-400">{col.stats?.uniqueCount ?? 0} unique values</p>
                </div>
              </button>
            ))}
          </div>

          {/* Aggregate results */}
          {aggregate.data && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-3 font-medium text-slate-900 dark:text-white">Aggregation Result</h3>
              <div className="space-y-1.5">
                {(aggregate.data.data as any[]).slice(0, 20).map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="min-w-[120px] text-sm text-slate-600 dark:text-slate-300 truncate">{item.label ?? `Row ${i + 1}`}</span>
                    <div className="flex-1 rounded-full bg-slate-100 dark:bg-slate-700 h-5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--color-accent)]"
                        style={{
                          width: `${Math.min(100, (Number(item.value) / Math.max(...(aggregate.data!.data as any[]).map((r: any) => Number(r.value) || 1))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="min-w-[60px] text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                      {Number(item.value).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab content: Analyses */}
      {tab === 'analyses' && (
        <div className="space-y-4">
          {analyses.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No saved analyses yet. Use Quick Charts to explore data.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {analyses.map((analysis) => (
                <div key={analysis.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono dark:bg-slate-700">{analysis.type}</span>
                      <h4 className="mt-1 font-medium text-slate-900 dark:text-white">{analysis.title}</h4>
                      {analysis.description && (
                        <p className="mt-0.5 text-xs text-slate-400">{analysis.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">{new Date(analysis.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-0.5 font-medium text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
