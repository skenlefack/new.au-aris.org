'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Download, Filter } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useHubTransactions,
  useHubConnections,
  type HubTransaction,
  type HubTransactionStatus,
  type HubDirection,
} from '@/lib/api/hub-hooks';

const TX_STATUS_CLS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-gray-100 text-gray-700',
  AWAITING_APPROVAL: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

const STATUSES: HubTransactionStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'AWAITING_APPROVAL'];
const DIRECTIONS: HubDirection[] = ['INBOUND', 'OUTBOUND', 'BIDIRECTIONAL'];
const DOMAINS = ['animal-health', 'livestock-prod', 'fisheries', 'wildlife', 'apiculture', 'trade-sps', 'governance', 'climate-env'];

export default function TransactionsListPage() {
  const t = useTranslations('interopHub');
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const [domain, setDomain] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: connData } = useHubConnections({ limit: 100 });
  const connections = connData?.data ?? [];

  const { data, isLoading } = useHubTransactions({
    direction: (direction as HubDirection) || undefined,
    status: (status as HubTransactionStatus) || undefined,
    domain: domain || undefined,
    connectionId: connectionId || undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
    page,
    limit,
  });

  const transactions = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('transactions.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('transactions.subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label={t('filter.direction')}
          value={direction}
          onChange={(v) => { setDirection(v); setPage(1); }}
          options={DIRECTIONS.map((d) => ({ value: d, label: t(`direction.${d}`) }))}
          allLabel={t('filter.all')}
        />
        <FilterSelect
          label={t('filter.status')}
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={STATUSES.map((s) => ({ value: s, label: s }))}
          allLabel={t('filter.all')}
        />
        <FilterSelect
          label={t('filter.domain')}
          value={domain}
          onChange={(v) => { setDomain(v); setPage(1); }}
          options={DOMAINS.map((d) => ({ value: d, label: d }))}
          allLabel={t('filter.all')}
        />
        <FilterSelect
          label={t('filter.connection')}
          value={connectionId}
          onChange={(v) => { setConnectionId(v); setPage(1); }}
          options={connections.map((c) => ({ value: c.id, label: c.name }))}
          allLabel={t('filter.all')}
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('filter.dateFrom')}</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('filter.dateTo')}</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="w-8 px-4 py-3" />
                <th className="px-4 py-3 font-medium">{t('col.id')}</th>
                <th className="px-4 py-3 font-medium">{t('col.direction')}</th>
                <th className="px-4 py-3 font-medium">{t('col.connection')}</th>
                <th className="px-4 py-3 font-medium">{t('col.domain')}</th>
                <th className="px-4 py-3 font-medium">{t('col.records')}</th>
                <th className="px-4 py-3 font-medium">{t('col.status')}</th>
                <th className="px-4 py-3 font-medium">{t('col.date')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={8} className="px-4 py-4"><div className="h-5 animate-pulse rounded bg-muted" /></td>
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">{t('transactions.empty')}</td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isExpanded = expanded === tx.id;
                  return (
                    <React.Fragment key={tx.id}>
                      <tr className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => setExpanded(isExpanded ? null : tx.id)} className="rounded p-1 hover:bg-muted">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/interop-hub/transactions/${tx.id}`} className="font-mono text-xs text-primary hover:underline">
                            {tx.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs">{t(`direction.${tx.direction}`)}</td>
                        <td className="px-4 py-3 text-xs">{tx.connection?.name ?? '-'}</td>
                        <td className="px-4 py-3 text-xs">{tx.domain}</td>
                        <td className="px-4 py-3 text-xs">
                          {tx.processedRecords}/{tx.totalRecords}
                          {tx.failedRecords > 0 && <span className="ml-1 text-red-600">({tx.failedRecords} failed)</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TX_STATUS_CLS[tx.status] ?? 'bg-gray-100'}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b bg-muted/20">
                          <td colSpan={8} className="px-8 py-3">
                            <div className="space-y-2 text-xs">
                              <p><span className="font-medium">{t('detail.entity')}:</span> {tx.entity || '-'}</p>
                              <p><span className="font-medium">{t('detail.pipeline')}:</span> {tx.pipeline?.name ?? tx.pipelineId?.slice(0, 8) ?? '-'}</p>
                              {tx.errorMessage && (
                                <p className="text-red-600"><span className="font-medium">{t('detail.error')}:</span> {tx.errorMessage}</p>
                              )}
                              {tx.stepLogs && tx.stepLogs.length > 0 && (
                                <div>
                                  <p className="mb-1 font-medium">{t('detail.stepLog')}:</p>
                                  <div className="space-y-1">
                                    {tx.stepLogs.map((sl) => (
                                      <div key={sl.id} className="flex items-center gap-2">
                                        <span className={`inline-block h-2 w-2 rounded-full ${sl.status === 'SUCCESS' ? 'bg-green-500' : sl.status === 'FAILED' ? 'bg-red-500' : 'bg-gray-400'}`} />
                                        <span>{sl.stepName}</span>
                                        <span className="text-muted-foreground">{sl.durationMs}ms</span>
                                        {sl.errorMessage && <span className="text-red-600">- {sl.errorMessage}</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {t('pagination.showing', { from: String((page - 1) * limit + 1), to: String(Math.min(page * limit, total)), total: String(total) })}
            </p>
            <div className="flex gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-50">{t('pagination.prev')}</button>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-50">{t('pagination.next')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, allLabel }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; allLabel: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
