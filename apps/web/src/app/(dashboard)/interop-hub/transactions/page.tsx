'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown, ChevronRight, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Activity,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import {
  useHubTransactions,
  useHubConnections,
  type HubTransaction,
  type HubTransactionStatus,
  type HubDirection,
} from '@/lib/api/hub-hooks';

/* ── Constants ────────────────────────────────────────────────── */

const TX_DOT: Record<string, string> = {
  COMPLETED: 'bg-emerald-500', FAILED: 'bg-red-500', IN_PROGRESS: 'bg-blue-500',
  PENDING: 'bg-gray-400', AWAITING_APPROVAL: 'bg-purple-500', CANCELLED: 'bg-gray-400',
};

const DIR_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  INBOUND: { icon: ArrowDownLeft, color: 'text-blue-500' },
  OUTBOUND: { icon: ArrowUpRight, color: 'text-emerald-500' },
  BIDIRECTIONAL: { icon: ArrowLeftRight, color: 'text-purple-500' },
};

const STATUSES: HubTransactionStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'AWAITING_APPROVAL'];
const DIRECTIONS: HubDirection[] = ['INBOUND', 'OUTBOUND', 'BIDIRECTIONAL'];
const DOMAINS = ['animal-health', 'livestock-prod', 'fisheries', 'wildlife', 'apiculture', 'trade-sps', 'governance', 'climate-env'];

/* ── Page ─────────────────────────────────────────────────────── */

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
    page, limit,
  });

  const transactions = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('transactions.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('transactions.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Advanced filter bar */}
      <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Direction toggle */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('filter.direction')}</label>
            <div className="flex rounded-lg border border-border/50 overflow-hidden">
              <DirToggle label={t('filter.all')} active={!direction} onClick={() => { setDirection(''); setPage(1); }} />
              {DIRECTIONS.map((d) => (
                <DirToggle key={d} label={t(`direction.${d}`)} active={direction === d} onClick={() => { setDirection(d); setPage(1); }} />
              ))}
            </div>
          </div>

          {/* Status multi-select as pills */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('filter.status')}</label>
            <div className="flex flex-wrap gap-1">
              <FilterPill label={t('filter.all')} active={!status} onClick={() => { setStatus(''); setPage(1); }} />
              {STATUSES.map((s) => (
                <FilterPill key={s} label={s} active={status === s} onClick={() => { setStatus(s); setPage(1); }} dot={TX_DOT[s]} />
              ))}
            </div>
          </div>

          {/* Domain */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('filter.domain')}</label>
            <select
              value={domain}
              onChange={(e) => { setDomain(e.target.value); setPage(1); }}
              className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            >
              <option value="">{t('filter.all')}</option>
              {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Connection */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('filter.connection')}</label>
            <select
              value={connectionId}
              onChange={(e) => { setConnectionId(e.target.value); setPage(1); }}
              className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            >
              <option value="">{t('filter.all')}</option>
              {connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Date range */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('filter.dateFrom')}</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('filter.dateTo')}</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
          </div>
        </div>
      </div>

      {/* Transaction list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-card/50 border border-border/50" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Activity className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">{t('transactions.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => {
            const isExpanded = expanded === tx.id;
            const dirCfg = DIR_ICON[tx.direction] ?? DIR_ICON.BIDIRECTIONAL;
            const DirI = dirCfg.icon;
            const progress = tx.totalRecords > 0 ? Math.round((tx.processedRecords / tx.totalRecords) * 100) : 0;
            const duration = tx.startedAt && tx.completedAt
              ? Math.round((new Date(tx.completedAt).getTime() - new Date(tx.startedAt).getTime()) / 1000)
              : null;

            return (
              <div key={tx.id} className="rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-4 p-4">
                  {/* Direction arrow */}
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50', dirCfg.color)}>
                    <DirI className="h-5 w-5" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/interop-hub/transactions/${tx.id}`} className="font-mono text-xs text-primary hover:underline font-medium">
                        {tx.id.slice(0, 8)}
                      </Link>
                      <span className="inline-flex rounded-full bg-purple-100 dark:bg-purple-950/30 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300">
                        {tx.domain}
                      </span>
                      {tx.entity && (
                        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {tx.entity}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{tx.connection?.name ?? '-'}</span>
                      <span>{tx.processedRecords}/{tx.totalRecords} records</span>
                      {tx.failedRecords > 0 && <span className="text-red-500">{tx.failedRecords} failed</span>}
                      {duration !== null && <span>{duration}s</span>}
                    </div>

                    {/* Progress bar for in-progress */}
                    {tx.status === 'IN_PROGRESS' && (
                      <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Status + expand */}
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                    <span className={cn('h-2 w-2 rounded-full', TX_DOT[tx.status] ?? 'bg-gray-400')} />
                    {tx.status}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(tx.createdAt).toLocaleDateString()}</span>
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : tx.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md transition-all hover:bg-accent"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>

                {/* Expanded step log */}
                {isExpanded && (
                  <div className="border-t border-border/30 px-6 py-4 animate-in slide-in-from-top-1 fade-in duration-200">
                    <div className="space-y-2 text-xs">
                      <p><span className="font-medium text-muted-foreground">{t('detail.entity')}:</span> {tx.entity || '-'}</p>
                      <p><span className="font-medium text-muted-foreground">{t('detail.pipeline')}:</span> {tx.pipeline?.name ?? tx.pipelineId?.slice(0, 8) ?? '-'}</p>
                      {tx.errorMessage && (
                        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10 p-2 text-red-600">
                          <span className="font-medium">{t('detail.error')}:</span> {tx.errorMessage}
                        </div>
                      )}
                      {tx.stepLogs && tx.stepLogs.length > 0 && (
                        <div>
                          <p className="mb-2 font-medium text-muted-foreground">{t('detail.stepLog')}:</p>
                          <div className="space-y-1">
                            {tx.stepLogs.map((sl) => (
                              <div key={sl.id} className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1.5">
                                <span className={cn('h-2 w-2 rounded-full', sl.status === 'SUCCESS' ? 'bg-emerald-500' : sl.status === 'FAILED' ? 'bg-red-500' : 'bg-gray-400')} />
                                <span className="font-medium">{sl.stepName}</span>
                                <span className="text-muted-foreground">{sl.durationMs}ms</span>
                                {sl.errorMessage && <span className="text-red-500 truncate">- {sl.errorMessage}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {t('pagination.showing', { from: String((page - 1) * limit + 1), to: String(Math.min(page * limit, total)), total: String(total) })}
              </p>
              <div className="flex gap-1">
                <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-xs font-medium transition-all hover:bg-accent disabled:opacity-40">{t('pagination.prev')}</button>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-xs font-medium transition-all hover:bg-accent disabled:opacity-40">{t('pagination.next')}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────── */

function FilterPill({ label, active, onClick, dot }: {
  label: string; active: boolean; onClick: () => void; dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-200',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-card/50 border border-border/50 text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
      {label}
    </button>
  );
}

function DirToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-xs font-medium transition-all border-r border-border/50 last:border-r-0',
        active ? 'bg-primary text-primary-foreground' : 'bg-card/50 text-muted-foreground hover:bg-accent'
      )}
    >
      {label}
    </button>
  );
}
