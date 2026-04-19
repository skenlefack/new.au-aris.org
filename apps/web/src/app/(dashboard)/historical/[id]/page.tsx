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
  useUpdateDatasetRow,
  useTimeSeriesData,
  type DatasetColumn,
} from '@/lib/api/historical-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations } from '@/lib/i18n/translations';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

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

type Tab = 'data' | 'columns' | 'charts' | 'timeseries' | 'analyses';

export default function DatasetDetailPage() {
  const t = useTranslations('historical');
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
  const updateRow = useUpdateDatasetRow();
  const timeSeries = useTimeSeriesData();

  const [tsDateCol, setTsDateCol] = useState('');
  const [tsValueCol, setTsValueCol] = useState('');
  const [tsInterval, setTsInterval] = useState<string>('month');
  const [tsOperation, setTsOperation] = useState<string>('count');
  const [chartType, setChartType] = useState<'bar' | 'pie' | 'line' | 'scatter'>('bar');
  const [chartGroupBy, setChartGroupBy] = useState('');

  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const dataset = dsResponse?.data;
  const rows = dataResponse?.data ?? [];
  const dataMeta = dataResponse?.meta;
  const analyses = analysesResponse?.data ?? [];

  const canManage = user && ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN'].includes(user.role);

  if (dsLoading) {
    return <div className="flex items-center justify-center py-20 text-slate-400">{t('loading')}</div>;
  }

  if (!dataset) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-slate-500">{t('notFound')}</p>
        <Link href="/historical" className="mt-3 text-sm text-[var(--color-accent)] hover:underline">{t('backToDatasets')}</Link>
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
        <MetaItem label={t('domains')} value={DOMAIN_LABELS[dataset.domain] ?? dataset.domain} />
        <MetaItem label={t('fileType')} value={dataset.fileType.toUpperCase()} />
        <MetaItem label={t('rows')} value={dataset.rowCount.toLocaleString()} />
        <MetaItem label={t('columns')} value={String(dataset.columnCount)} />
        <MetaItem label={t('size')} value={formatBytes(dataset.fileSizeBytes)} />
        <MetaItem label={t('imported')} value={new Date(dataset.created_at).toLocaleDateString()} />
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
          { key: 'data', label: t('tabData') },
          { key: 'columns', label: t('tabColumns', { count: columns.length }) },
          { key: 'charts', label: t('tabCharts') },
          { key: 'timeseries', label: 'Time Series' },
          { key: 'analyses', label: t('tabAnalyses', { count: analyses.length }) },
        ] as const).map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === tabItem.key
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* Tab content: Data */}
      {tab === 'data' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder={t('searchData')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setDataPage(1); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
            />
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">{t('loadingData')}</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-slate-400">{t('noData')}</div>
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
                    {canManage && <th className="px-3 py-2 font-medium text-slate-500">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {rows.map((row: any, ri: number) => {
                    const rowId = row._row_id ?? (dataPage - 1) * 50 + ri + 1;
                    const isEditing = editingRowId === rowId;
                    return (
                      <tr key={ri} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-3 py-1.5 text-slate-400">{rowId}</td>
                        {columns.slice(0, 10).map((col) => (
                          <td key={col.id} className="px-3 py-1.5">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editValues[col.pgColumnName] ?? ''}
                                onChange={(e) => setEditValues((prev) => ({ ...prev, [col.pgColumnName]: e.target.value }))}
                                className="w-full min-w-[80px] rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                              />
                            ) : (
                              <span className="text-slate-600 dark:text-slate-300 whitespace-nowrap max-w-[200px] truncate block">
                                {String(row[col.pgColumnName] ?? '')}
                              </span>
                            )}
                          </td>
                        ))}
                        {columns.length > 10 && <td className="px-3 py-1.5 text-slate-400">...</td>}
                        {canManage && (
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={async () => {
                                    await updateRow.mutateAsync({ datasetId: id, rowId, data: editValues });
                                    setEditingRowId(null);
                                    setEditValues({});
                                  }}
                                  disabled={updateRow.isPending}
                                  className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  {updateRow.isPending ? '...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => { setEditingRowId(null); setEditValues({}); }}
                                  className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingRowId(rowId);
                                  const vals: Record<string, string> = {};
                                  for (const col of columns.slice(0, 10)) {
                                    vals[col.pgColumnName] = String(row[col.pgColumnName] ?? '');
                                  }
                                  setEditValues(vals);
                                }}
                                className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
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
                <th className="px-4 py-3 font-medium text-slate-500">{t('pgColumn')}</th>
                <th className="px-4 py-3 font-medium text-slate-500">{t('columnType')}</th>
                <th className="px-4 py-3 font-medium text-slate-500">{t('nullable')}</th>
                <th className="px-4 py-3 font-medium text-slate-500">{t('uniqueValues')}</th>
                <th className="px-4 py-3 font-medium text-slate-500">{t('nulls')}</th>
                <th className="px-4 py-3 font-medium text-slate-500">{t('range')}</th>
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
        <div className="space-y-5">
          {/* Controls */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex flex-wrap items-end gap-4">
              {/* Column selector */}
              <div className="flex-1 min-w-[180px]">
                <label className="mb-1 block text-xs font-medium text-slate-500">Column to analyze</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {columns.filter(c => !c.name.startsWith('__')).map((col) => (
                    <button
                      key={col.id}
                      onClick={() => {
                        const op = col.dataType === 'INTEGER' || col.dataType === 'FLOAT' ? 'sum' : 'distribution';
                        aggregate.mutate({ datasetId: id, column: col.pgColumnName, operation: op, groupBy: chartGroupBy || undefined });
                      }}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                        aggregate.variables?.column === col.pgColumnName
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 text-[var(--color-accent)]'
                          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50'
                      }`}
                    >
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-slate-700">{col.dataType}</span>
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300">{col.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Chart type + GroupBy */}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Chart type</label>
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  {(['bar', 'pie', 'line', 'scatter'] as const).map((ct) => (
                    <button
                      key={ct}
                      onClick={() => setChartType(ct)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        chartType === ct
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {ct === 'bar' ? 'Bar' : ct === 'pie' ? 'Pie' : ct === 'line' ? 'Line' : 'Scatter'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-w-[150px]">
                <label className="mb-1 block text-xs font-medium text-slate-500">Group by (optional)</label>
                <select
                  value={chartGroupBy}
                  onChange={(e) => setChartGroupBy(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">None</option>
                  {columns.filter(c => !c.name.startsWith('__') && c.dataType === 'TEXT').map((c) => (
                    <option key={c.id} value={c.pgColumnName}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Chart Result */}
          {aggregate.isPending && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[var(--color-accent)]" />
            </div>
          )}

          {aggregate.data && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
                {aggregate.variables?.column} — {aggregate.variables?.operation}
                {chartGroupBy && ` (grouped by ${chartGroupBy})`}
              </h3>
              <div className="h-[400px]">
                <AggregateChart data={(aggregate.data.data as any[]).slice(0, 25)} type={chartType} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab content: Time Series */}
      {tab === 'timeseries' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/50">
            <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Configure Time Series</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Date column selector */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Date Column</label>
                <select
                  value={tsDateCol}
                  onChange={(e) => setTsDateCol(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                >
                  <option value="">-- Select date column --</option>
                  {columns
                    .filter((c) => c.name.toLowerCase().includes('date') || c.dataType === 'DATE')
                    .map((c) => (
                      <option key={c.id} value={c.pgColumnName}>{c.name}</option>
                    ))}
                </select>
              </div>
              {/* Value column selector */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Value Column</label>
                <select
                  value={tsValueCol}
                  onChange={(e) => setTsValueCol(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                >
                  <option value="">-- Select value column --</option>
                  {columns
                    .filter((c) => ['INTEGER', 'FLOAT', 'TEXT'].includes(c.dataType) && !c.name.toLowerCase().includes('date'))
                    .map((c) => (
                      <option key={c.id} value={c.pgColumnName}>{c.name} ({c.dataType})</option>
                    ))}
                </select>
              </div>
              {/* Interval */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Interval</label>
                <select
                  value={tsInterval}
                  onChange={(e) => setTsInterval(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
              </div>
              {/* Operation */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Operation</label>
                <select
                  value={tsOperation}
                  onChange={(e) => setTsOperation(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                >
                  <option value="count">Count</option>
                  <option value="sum">Sum</option>
                  <option value="avg">Average</option>
                </select>
              </div>
            </div>
            <button
              onClick={() => {
                if (!tsDateCol || !tsValueCol) return;
                timeSeries.mutate({ datasetId: id, dateColumn: tsDateCol, valueColumn: tsValueCol, interval: tsInterval, operation: tsOperation });
              }}
              disabled={!tsDateCol || !tsValueCol || timeSeries.isPending}
              className="mt-4 rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {timeSeries.isPending ? 'Generating...' : 'Generate Chart'}
            </button>
          </div>

          {/* Time Series Chart */}
          {timeSeries.data && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
                {tsOperation.charAt(0).toUpperCase() + tsOperation.slice(1)} of {tsValueCol} by {tsInterval}
              </h3>
              <div className="h-[400px]">
                <TimeSeriesChart data={timeSeries.data.data as any[]} />
              </div>
            </div>
          )}

          {timeSeries.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-400">
              Error: {timeSeries.error?.message}
            </div>
          )}
        </div>
      )}

      {/* Tab content: Analyses */}
      {tab === 'analyses' && (
        <div className="space-y-4">
          {analyses.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              {t('noAnalyses')}
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

function TimeSeriesChart({ data }: { data: Array<{ period: string; value: number }> }) {
  const chartData = data
    .filter((d) => d.period)
    .map((d) => ({
      period: new Date(d.period).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
      value: Number(d.value) || 0,
    }));

  if (chartData.length === 0) {
    return <div className="flex h-full items-center justify-center text-slate-400">No data for the selected parameters</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="tsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2e75b6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2e75b6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: 'none',
            borderRadius: '8px',
            color: '#f1f5f9',
            fontSize: 12,
          }}
          formatter={(value: number) => [value.toLocaleString(), 'Value']}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#2e75b6"
          strokeWidth={2}
          fill="url(#tsGrad)"
          dot={chartData.length < 50}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Multi-type Aggregate Chart ────────────────────────── */

const CHART_COLORS = ['#2e75b6', '#e67e22', '#27ae60', '#c0392b', '#8e44ad', '#16a085', '#d35400', '#f39c12', '#1abc9c', '#2c3e50'];

function AggregateChart({ data, type }: { data: any[]; type: 'bar' | 'pie' | 'line' | 'scatter' }) {
  const chartData = data.map((d: any, i: number) => ({
    name: String(d.label ?? `#${i + 1}`).slice(0, 25),
    value: Number(d.value) || 0,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  if (chartData.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">No results</div>;
  }

  const tooltipStyle = { backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 };
  const formatter = (v: number) => [v.toLocaleString(), 'Value'];

  if (type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={140}
            innerRadius={70}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={formatter} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} angle={-45} textAnchor="end" height={80} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <Tooltip contentStyle={tooltipStyle} formatter={formatter} />
          <Line type="monotone" dataKey="value" stroke="#2e75b6" strokeWidth={2} dot={{ r: 4, fill: '#2e75b6' }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'scatter') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} angle={-45} textAnchor="end" height={80} />
          <YAxis dataKey="value" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Scatter data={chartData} fill="#2e75b6">
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  // Default: Bar chart (horizontal)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <Tooltip contentStyle={tooltipStyle} formatter={formatter} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
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
