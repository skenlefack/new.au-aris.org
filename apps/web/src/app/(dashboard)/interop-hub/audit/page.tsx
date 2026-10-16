'use client';

import React, { useState } from 'react';
import { Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { useHubAuditLogs, type HubAuditAction } from '@/lib/api/hub-hooks';

const ACTION_CLS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  ACTIVATE: 'bg-emerald-100 text-emerald-700',
  SUSPEND: 'bg-orange-100 text-orange-700',
  EXECUTE: 'bg-indigo-100 text-indigo-700',
  APPROVE: 'bg-teal-100 text-teal-700',
  REJECT: 'bg-red-100 text-red-700',
  RETRY: 'bg-amber-100 text-amber-700',
  CANCEL: 'bg-gray-100 text-gray-600',
};

const ENTITY_TYPES = ['CONNECTION', 'PIPELINE', 'TRANSACTION', 'AGREEMENT', 'SCHEDULE', 'MAPPING'];
const ACTIONS: HubAuditAction[] = ['CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'SUSPEND', 'EXECUTE', 'APPROVE', 'REJECT', 'RETRY', 'CANCEL'];

export default function AuditLogPage() {
  const t = useTranslations('interopHub');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 30;

  const { data, isLoading } = useHubAuditLogs({
    entityType: entityType || undefined,
    action: (action as HubAuditAction) || undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
    page,
    limit,
  });

  const logs = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('audit.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('audit.subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label={t('filter.entityType')}
          value={entityType}
          onChange={(v) => { setEntityType(v); setPage(1); }}
          options={ENTITY_TYPES.map((e) => ({ value: e, label: e }))}
          allLabel={t('filter.all')}
        />
        <FilterSelect
          label={t('filter.action')}
          value={action}
          onChange={(v) => { setAction(v); setPage(1); }}
          options={ACTIONS.map((a) => ({ value: a, label: a }))}
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
                <th className="px-4 py-3 font-medium">{t('col.date')}</th>
                <th className="px-4 py-3 font-medium">{t('col.action')}</th>
                <th className="px-4 py-3 font-medium">{t('col.entityType')}</th>
                <th className="px-4 py-3 font-medium">{t('col.entityId')}</th>
                <th className="px-4 py-3 font-medium">{t('col.actor')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={6} className="px-4 py-4"><div className="h-5 animate-pulse rounded bg-muted" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('audit.empty')}</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expanded === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3">
                          {log.details && (
                            <button type="button" onClick={() => setExpanded(isExpanded ? null : log.id)} className="rounded p-1 hover:bg-muted">
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_CLS[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">{log.entityType}</td>
                        <td className="px-4 py-3 font-mono text-xs">{log.entityId.slice(0, 8)}</td>
                        <td className="px-4 py-3 text-xs">{log.actorId?.slice(0, 8) ?? '-'}</td>
                      </tr>
                      {isExpanded && log.details && (
                        <tr className="border-b bg-muted/20">
                          <td colSpan={6} className="px-8 py-3">
                            <pre className="max-h-48 overflow-auto rounded bg-muted p-3 text-xs">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                            {log.previousState && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs text-primary">{t('audit.previousState')}</summary>
                                <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                                  {JSON.stringify(log.previousState, null, 2)}
                                </pre>
                              </details>
                            )}
                            {log.newState && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs text-primary">{t('audit.newState')}</summary>
                                <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                                  {JSON.stringify(log.newState, null, 2)}
                                </pre>
                              </details>
                            )}
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
