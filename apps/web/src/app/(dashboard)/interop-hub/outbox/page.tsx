'use client';

import React, { useState } from 'react';
import { Send, X, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useHubOutbox,
  useApproveHubTransaction,
  useCancelHubTransaction,
  type HubTransaction,
} from '@/lib/api/hub-hooks';

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

  function bulkSend() {
    selected.forEach((id) => sendMut.mutate({ id }));
    setSelected(new Set());
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('outbox.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('outbox.subtitle')}</p>
        </div>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={bulkSend}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Send className="h-3.5 w-3.5" /> {t('actions.sendSelected', { count: String(selected.size) })}
          </button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">
                  <input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={toggleAll} className="h-4 w-4 rounded" />
                </th>
                <th className="px-4 py-3 font-medium">{t('col.destination')}</th>
                <th className="px-4 py-3 font-medium">{t('col.domain')}</th>
                <th className="px-4 py-3 font-medium">{t('col.format')}</th>
                <th className="px-4 py-3 font-medium">{t('col.records')}</th>
                <th className="px-4 py-3 font-medium">{t('col.status')}</th>
                <th className="px-4 py-3 font-medium">{t('col.actions')}</th>
                <th className="w-8 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={8} className="px-4 py-4"><div className="h-5 animate-pulse rounded bg-muted" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Send className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('outbox.empty')}</p>
                  </td>
                </tr>
              ) : (
                items.map((tx) => {
                  const isExpanded = expanded === tx.id;
                  const TX_CLS: Record<string, string> = {
                    PENDING: 'bg-gray-100 text-gray-700',
                    AWAITING_APPROVAL: 'bg-purple-100 text-purple-700',
                    IN_PROGRESS: 'bg-blue-100 text-blue-700',
                    COMPLETED: 'bg-green-100 text-green-700',
                    FAILED: 'bg-red-100 text-red-700',
                  };
                  return (
                    <React.Fragment key={tx.id}>
                      <tr className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selected.has(tx.id)} onChange={() => toggleSelect(tx.id)} className="h-4 w-4 rounded" />
                        </td>
                        <td className="px-4 py-3 text-xs">{tx.connection?.name ?? tx.connectionId?.slice(0, 8)}</td>
                        <td className="px-4 py-3 text-xs">{tx.domain}</td>
                        <td className="px-4 py-3 text-xs">{tx.metadata?.format as string ?? '-'}</td>
                        <td className="px-4 py-3 text-xs">{tx.totalRecords}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TX_CLS[tx.status] ?? 'bg-gray-100'}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => sendMut.mutate({ id: tx.id })}
                              className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                            >
                              <Send className="h-3 w-3" /> {t('actions.send')}
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelMut.mutate(tx.id)}
                              className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent"
                            >
                              <X className="h-3 w-3" /> {t('actions.cancel')}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => setExpanded(isExpanded ? null : tx.id)} className="rounded p-1 hover:bg-muted">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b bg-muted/20">
                          <td colSpan={8} className="px-8 py-3">
                            <p className="mb-1 text-xs font-medium">{t('outbox.exportPreview')}</p>
                            <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                              {JSON.stringify(tx.metadata ?? { records: tx.totalRecords, entity: tx.entity }, null, 2)}
                            </pre>
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
            <p className="text-xs text-muted-foreground">{total} {t('outbox.total')}</p>
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
