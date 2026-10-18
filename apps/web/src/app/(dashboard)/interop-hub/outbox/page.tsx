'use client';

import React, { useState } from 'react';
import { Send, X, ChevronDown, Eye, Server } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import {
  useHubOutbox,
  useApproveHubTransaction,
  useCancelHubTransaction,
  type HubTransaction,
} from '@/lib/api/hub-hooks';

/* ── Constants ────────────────────────────────────────────────── */

const TX_DOT: Record<string, string> = {
  PENDING: 'bg-gray-400', AWAITING_APPROVAL: 'bg-purple-500', IN_PROGRESS: 'bg-blue-500',
  COMPLETED: 'bg-emerald-500', FAILED: 'bg-red-500',
};

/* ── Page ─────────────────────────────────────────────────────── */

export default function OutboxPage() {
  const t = useTranslations('interopHub');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useHubOutbox({ page, limit });
  const items = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const sendMut = useApproveHubTransaction();
  const cancelMut = useCancelHubTransaction();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  }
  function bulkSend() {
    selected.forEach((id) => sendMut.mutate({ id }));
    setSelected(new Set());
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('outbox.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('outbox.subtitle')}</p>
            </div>
          </div>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={bulkSend}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:-translate-y-0.5"
            >
              <Send className="h-3.5 w-3.5" /> {t('actions.sendSelected', { count: String(selected.size) })}
            </button>
          )}
        </div>
      </div>

      {/* Select all bar */}
      {items.length > 0 && (
        <div className="flex items-center gap-3 px-2">
          <input
            type="checkbox"
            checked={items.length > 0 && selected.size === items.length}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-xs text-muted-foreground">
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </span>
        </div>
      )}

      {/* Outbox cards */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-card/50 border border-border/50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Send className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-4 text-base font-medium text-muted-foreground">{t('outbox.empty')}</p>
          <p className="mt-1 text-xs text-muted-foreground">No outgoing data packages</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((tx) => {
            const isExpanded = expanded === tx.id;
            return (
              <div
                key={tx.id}
                className={cn(
                  'rounded-xl bg-card/50 backdrop-blur-sm border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
                  selected.has(tx.id) ? 'border-primary/50 bg-primary/5' : 'border-border/50'
                )}
              >
                <div className="flex items-center gap-4 p-4">
                  <input
                    type="checkbox"
                    checked={selected.has(tx.id)}
                    onChange={() => toggleSelect(tx.id)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                    <Server className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{tx.connection?.name ?? tx.connectionId?.slice(0, 8)}</p>
                      <span className="inline-flex rounded-full bg-indigo-100 dark:bg-indigo-950/30 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300">
                        {tx.domain}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px]">
                        <span className={cn('h-1.5 w-1.5 rounded-full', TX_DOT[tx.status] ?? 'bg-gray-400')} />
                        {tx.status}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{tx.totalRecords} records</span>
                      <span>{(tx.metadata as any)?.format ?? '-'}</span>
                      <span>{new Date(tx.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : tx.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 transition-all hover:bg-accent"
                      title="Preview"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => sendMut.mutate({ id: tx.id })}
                      className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <Send className="h-3 w-3" /> {t('actions.send')}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelMut.mutate(tx.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border/50 px-3 py-1.5 text-xs font-medium transition-all hover:bg-accent"
                    >
                      <X className="h-3 w-3" /> {t('actions.cancel')}
                    </button>
                  </div>
                </div>

                {/* Preview */}
                {isExpanded && (
                  <div className="border-t border-border/30 px-6 py-4 animate-in slide-in-from-top-1 fade-in duration-200">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">{t('outbox.exportPreview')}</p>
                    <pre className="max-h-48 overflow-auto rounded-lg bg-muted/50 border border-border/30 p-3 text-xs font-mono">
                      {JSON.stringify(tx.metadata ?? { records: tx.totalRecords, entity: tx.entity }, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 px-5 py-3">
              <p className="text-xs text-muted-foreground">{total} {t('outbox.total')}</p>
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
