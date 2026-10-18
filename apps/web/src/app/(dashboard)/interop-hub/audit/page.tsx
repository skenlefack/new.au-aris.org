'use client';

import React, { useState, useMemo } from 'react';
import {
  Shield, ChevronDown, ChevronRight,
  Plus, Pencil, Trash2, Zap, Play, Pause, Check, X, RefreshCw, Ban,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import { useHubAuditLogs, type HubAuditAction } from '@/lib/api/hub-hooks';

/* ── Constants ────────────────────────────────────────────────── */

const ACTION_CFG: Record<string, { icon: React.ElementType; dot: string }> = {
  CREATE: { icon: Plus, dot: 'bg-emerald-500' },
  UPDATE: { icon: Pencil, dot: 'bg-blue-500' },
  DELETE: { icon: Trash2, dot: 'bg-red-500' },
  ACTIVATE: { icon: Play, dot: 'bg-emerald-500' },
  SUSPEND: { icon: Pause, dot: 'bg-amber-500' },
  EXECUTE: { icon: Zap, dot: 'bg-indigo-500' },
  APPROVE: { icon: Check, dot: 'bg-teal-500' },
  REJECT: { icon: X, dot: 'bg-red-500' },
  RETRY: { icon: RefreshCw, dot: 'bg-amber-500' },
  CANCEL: { icon: Ban, dot: 'bg-gray-400' },
};

const ENTITY_TYPES = ['CONNECTION', 'PIPELINE', 'TRANSACTION', 'AGREEMENT', 'SCHEDULE', 'MAPPING'];
const ACTIONS: HubAuditAction[] = ['CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'SUSPEND', 'EXECUTE', 'APPROVE', 'REJECT', 'RETRY', 'CANCEL'];

/* ── Page ─────────────────────────────────────────────────────── */

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
    page, limit,
  });

  const logs = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const [expanded, setExpanded] = useState<string | null>(null);

  // Group logs by date
  const grouped = useMemo(() => {
    const groups: Record<string, typeof logs> = {};
    for (const log of logs) {
      const day = new Date(log.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!groups[day]) groups[day] = [];
      groups[day].push(log);
    }
    return groups;
  }, [logs]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-500/10 via-slate-500/5 to-transparent" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-gray-600 to-slate-700 text-white shadow-lg shadow-gray-500/25">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('audit.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('audit.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('filter.entityType')}</label>
            <div className="flex flex-wrap gap-1">
              <FilterPill label={t('filter.all')} active={!entityType} onClick={() => { setEntityType(''); setPage(1); }} />
              {ENTITY_TYPES.map((e) => (
                <FilterPill key={e} label={e} active={entityType === e} onClick={() => { setEntityType(e); setPage(1); }} />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('filter.action')}</label>
            <div className="flex flex-wrap gap-1">
              <FilterPill label={t('filter.all')} active={!action} onClick={() => { setAction(''); setPage(1); }} />
              {ACTIONS.map((a) => (
                <FilterPill
                  key={a}
                  label={a}
                  active={action === a}
                  onClick={() => { setAction(a); setPage(1); }}
                  dot={(ACTION_CFG[a] ?? { dot: 'bg-gray-400' }).dot}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('filter.dateFrom')}</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('filter.dateTo')}</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
          </div>
        </div>
      </div>

      {/* Timeline audit log */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-card/50 border border-border/50" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">{t('audit.empty')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, dayLogs]) => (
            <div key={day}>
              {/* Date grouping header */}
              <div className="sticky top-0 z-10 mb-3">
                <div className="inline-flex rounded-full bg-muted/80 backdrop-blur-sm px-3 py-1 text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              </div>

              {/* Timeline entries */}
              <div className="relative ml-6">
                <div className="absolute left-3 top-3 bottom-3 w-px bg-border/50" />
                {dayLogs.map((log) => {
                  const cfg = ACTION_CFG[log.action] ?? { icon: Shield, dot: 'bg-gray-400' };
                  const Icon = cfg.icon;
                  const isExp = expanded === log.id;
                  const hasDetail = log.details || log.previousState || log.newState;

                  return (
                    <div key={log.id} className="relative flex gap-4 pb-4 last:pb-0">
                      {/* Timeline node */}
                      <div className="relative z-10 mt-1.5">
                        <div className={cn('flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background', cfg.dot)}>
                          <Icon className="h-3 w-3 text-white" />
                        </div>
                      </div>

                      {/* Content card */}
                      <div className={cn(
                        'min-w-0 flex-1 rounded-xl border transition-all duration-200',
                        isExp ? 'border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/10' : 'border-border/50 bg-card/50 backdrop-blur-sm hover:bg-accent/20'
                      )}>
                        <button
                          type="button"
                          onClick={hasDetail ? () => setExpanded(isExp ? null : log.id) : undefined}
                          className={cn('flex w-full items-center gap-3 p-3 text-left', hasDetail && 'cursor-pointer')}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                                log.action === 'CREATE' ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' :
                                log.action === 'DELETE' ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300' :
                                'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                              )}>
                                {log.action}
                              </span>
                              <span className="text-xs font-medium">{log.entityType}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{log.entityId.slice(0, 8)}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span>Actor: {log.actorId?.slice(0, 8) ?? '-'}</span>
                              {log.actorRole && <span>({log.actorRole})</span>}
                              <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                              {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                            </div>
                          </div>
                          {hasDetail && (
                            <span className="shrink-0">
                              {isExp ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </span>
                          )}
                        </button>

                        {/* Expanded detail */}
                        {isExp && hasDetail && (
                          <div className="border-t border-border/30 p-3 space-y-2 animate-in slide-in-from-top-1 fade-in duration-200">
                            {log.details && (
                              <div>
                                <p className="text-[10px] font-medium text-muted-foreground mb-1">Details</p>
                                <pre className="max-h-48 overflow-auto rounded-lg bg-muted/50 border border-border/30 p-2 text-xs font-mono">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.previousState && (
                              <details>
                                <summary className="cursor-pointer text-xs font-medium text-primary">{t('audit.previousState')}</summary>
                                <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-muted/50 border border-border/30 p-2 text-xs font-mono">
                                  {JSON.stringify(log.previousState, null, 2)}
                                </pre>
                              </details>
                            )}
                            {log.newState && (
                              <details>
                                <summary className="cursor-pointer text-xs font-medium text-primary">{t('audit.newState')}</summary>
                                <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-muted/50 border border-border/30 p-2 text-xs font-mono">
                                  {JSON.stringify(log.newState, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

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
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card/50 border border-border/50 text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
      {label}
    </button>
  );
}
