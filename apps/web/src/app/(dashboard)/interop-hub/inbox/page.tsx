'use client';

import { useState } from 'react';
import { Check, X, ChevronDown, ChevronRight, Inbox } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useHubInbox,
  useApproveHubTransaction,
  useRejectHubTransaction,
  type HubTransaction,
} from '@/lib/api/hub-hooks';

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
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('inbox.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('inbox.subtitle')}</p>
        </div>
        {selected.size > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={bulkApprove}
              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
            >
              <Check className="h-3.5 w-3.5" /> {t('actions.approveSelected', { count: String(selected.size) })}
            </button>
            <button
              type="button"
              onClick={bulkReject}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
            >
              <X className="h-3.5 w-3.5" /> {t('actions.rejectSelected', { count: String(selected.size) })}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selected.size === items.length}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded"
                  />
                </th>
                <th className="px-4 py-3 font-medium">{t('col.source')}</th>
                <th className="px-4 py-3 font-medium">{t('col.domain')}</th>
                <th className="px-4 py-3 font-medium">{t('col.records')}</th>
                <th className="px-4 py-3 font-medium">{t('col.received')}</th>
                <th className="px-4 py-3 font-medium">{t('col.actions')}</th>
                <th className="w-8 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-5 animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('inbox.empty')}</p>
                  </td>
                </tr>
              ) : (
                items.map((tx) => (
                  <InboxRow
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">{total} {t('inbox.total')}</p>
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

function InboxRow({
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
    <>
      <tr className="border-b hover:bg-muted/50">
        <td className="px-4 py-3">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} className="h-4 w-4 rounded" />
        </td>
        <td className="px-4 py-3 text-xs">{tx.connection?.name ?? tx.connectionId?.slice(0, 8)}</td>
        <td className="px-4 py-3 text-xs">{tx.domain}</td>
        <td className="px-4 py-3 text-xs">{tx.totalRecords}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onApprove}
              className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
            >
              <Check className="h-3 w-3" /> {t('actions.approve')}
            </button>
            <button
              type="button"
              onClick={onRejectOpen}
              className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
            >
              <X className="h-3 w-3" /> {t('actions.reject')}
            </button>
          </div>
        </td>
        <td className="px-4 py-3">
          <button type="button" onClick={onToggleExpand} className="p-1 hover:bg-muted rounded">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
      </tr>
      {rejectOpen && (
        <tr className="border-b bg-red-50">
          <td colSpan={7} className="px-8 py-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium">{t('inbox.rejectReason')}</label>
                <input
                  className="w-full rounded-md border px-3 py-1.5 text-sm"
                  value={rejectReason}
                  onChange={(e) => onRejectReasonChange(e.target.value)}
                  placeholder={t('inbox.rejectReasonPlaceholder')}
                />
              </div>
              <button
                type="button"
                disabled={!rejectReason}
                onClick={() => { onReject(rejectReason); onRejectOpen(); }}
                className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50"
              >
                {t('actions.confirmReject')}
              </button>
            </div>
          </td>
        </tr>
      )}
      {expanded && (
        <tr className="border-b bg-muted/20">
          <td colSpan={7} className="px-8 py-3">
            <p className="mb-1 text-xs font-medium">{t('inbox.dataPreview')}</p>
            <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(tx.metadata ?? { records: tx.totalRecords, entity: tx.entity }, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
