'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Check, X, ChevronDown, ChevronRight, Inbox, Eye, Server,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import {
  useHubInbox,
  useApproveHubTransaction,
  useRejectHubTransaction,
  type HubTransaction,
} from '@/lib/api/hub-hooks';

/* ── Page ─────────────────────────────────────────────────────── */

export default function InboxPage() {
  const t = useTranslations('interopHub');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useHubInbox({ page, limit, status: 'AWAITING_APPROVAL' });
  const items = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const approveMut = useApproveHubTransaction();
  const rejectMut = useRejectHubTransaction();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  }

  function bulkApprove() {
    selected.forEach((id) => approveMut.mutate({ id }));
    setSelected(new Set());
  }

  function bulkReject() {
    const reason = prompt(t('inbox.bulkRejectReason'));
    if (!reason) return;
    selected.forEach((id) => rejectMut.mutate({ id, reason }));
    setSelected(new Set());
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-transparent" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('inbox.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('inbox.subtitle')}</p>
            </div>
          </div>
          {total > 0 && (
            <div className="flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground">
              {total}
            </div>
          )}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 px-5 py-3 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <span className="text-xs font-medium">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={bulkApprove}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5"
            >
              <Check className="h-3.5 w-3.5" /> {t('actions.approveSelected', { count: String(selected.size) })}
            </button>
            <button
              type="button"
              onClick={bulkReject}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-red-500/25 transition-all hover:-translate-y-0.5"
            >
              <X className="h-3.5 w-3.5" /> {t('actions.rejectSelected', { count: String(selected.size) })}
            </button>
          </div>
        </div>
      )}

      {/* Inbox cards */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-card/50 border border-border/50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-4 text-base font-medium text-muted-foreground">{t('inbox.empty')}</p>
          <p className="mt-1 text-xs text-muted-foreground">No pending reviews at this time</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((tx) => (
            <InboxCard
              key={tx.id}
              tx={tx}
              expanded={expanded === tx.id}
              onToggleExpand={() => setExpanded(expanded === tx.id ? null : tx.id)}
              selected={selected.has(tx.id)}
              onToggleSelect={() => toggleSelect(tx.id)}
              onApprove={() => approveMut.mutate({ id: tx.id })}
              onReject={(reason) => rejectMut.mutate({ id: tx.id, reason })}
              rejectOpen={rejectId === tx.id}
              onRejectOpen={() => { setRejectId(rejectId === tx.id ? null : tx.id); setRejectReason(''); }}
              rejectReason={rejectReason}
              onRejectReasonChange={setRejectReason}
              t={t}
            />
          ))}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 px-5 py-3">
              <p className="text-xs text-muted-foreground">{total} {t('inbox.total')}</p>
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

/* ── Inbox card ───────────────────────────────────────────────── */

function InboxCard({
  tx, expanded, onToggleExpand, selected, onToggleSelect,
  onApprove, onReject, rejectOpen, onRejectOpen, rejectReason, onRejectReasonChange, t,
}: {
  tx: HubTransaction; expanded: boolean; onToggleExpand: () => void;
  selected: boolean; onToggleSelect: () => void;
  onApprove: () => void; onReject: (reason: string) => void;
  rejectOpen: boolean; onRejectOpen: () => void;
  rejectReason: string; onRejectReasonChange: (v: string) => void;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  return (
    <div className={cn(
      'rounded-xl bg-card/50 backdrop-blur-sm border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
      selected ? 'border-primary/50 bg-primary/5' : 'border-border/50'
    )}>
      <div className="flex items-center gap-4 p-4">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="h-4 w-4 rounded border-border transition-colors"
        />

        {/* Source icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50">
          <Server className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{tx.connection?.name ?? tx.connectionId?.slice(0, 8)}</p>
            <span className="inline-flex rounded-full bg-blue-100 dark:bg-blue-950/30 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
              {tx.domain}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{tx.totalRecords} records</span>
            <span>{tx.entity || '-'}</span>
            <span>{new Date(tx.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 transition-all hover:bg-accent"
            title="Preview"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <Check className="h-3 w-3" /> {t('actions.approve')}
          </button>
          <button
            type="button"
            onClick={onRejectOpen}
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <X className="h-3 w-3" /> {t('actions.reject')}
          </button>
        </div>
      </div>

      {/* Reject reason input */}
      {rejectOpen && (
        <div className="border-t border-border/30 bg-red-50/50 dark:bg-red-950/10 px-6 py-3 animate-in slide-in-from-top-1 fade-in duration-200">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium">{t('inbox.rejectReason')}</label>
              <input
                className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                value={rejectReason}
                onChange={(e) => onRejectReasonChange(e.target.value)}
                placeholder={t('inbox.rejectReasonPlaceholder')}
              />
            </div>
            <button
              type="button"
              disabled={!rejectReason}
              onClick={() => { onReject(rejectReason); onRejectOpen(); }}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-red-700 disabled:opacity-40"
            >
              {t('actions.confirmReject')}
            </button>
          </div>
        </div>
      )}

      {/* Data preview */}
      {expanded && (
        <div className="border-t border-border/30 px-6 py-4 animate-in slide-in-from-top-1 fade-in duration-200">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t('inbox.dataPreview')}</p>
          <pre className="max-h-48 overflow-auto rounded-lg bg-muted/50 border border-border/30 p-3 text-xs font-mono">
            {JSON.stringify(tx.metadata ?? { records: tx.totalRecords, entity: tx.entity }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
