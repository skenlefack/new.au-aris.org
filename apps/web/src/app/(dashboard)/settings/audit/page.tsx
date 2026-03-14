'use client';

import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  Shield,
  FileText,
  Settings,
  Upload,
  Trash2,
  CheckCircle,
  XCircle,
  Filter,
  User,
  Activity,
  Database,
  AlertTriangle,
  Download,
  X,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useAuditLog, type AuditEntry } from '@/lib/api/hooks';

/* ─── Constants ─────────────────────────────────────────────────────────────── */

/* ACTION_OPTIONS and ENTITY_TYPE_OPTIONS are now created inside the component for i18n */

const CLASSIFICATION_COLORS: Record<string, string> = {
  PUBLIC: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
  PARTNER: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  RESTRICTED: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  CONFIDENTIAL: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
};

const ACTION_STYLES: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  CREATE: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', icon: FileText },
  UPDATE: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', icon: Settings },
  DELETE: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', icon: Trash2 },
  VALIDATE: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30', icon: CheckCircle },
  REJECT: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', icon: XCircle },
  EXPORT: { color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/30', icon: Upload },
};

const ACTION_BADGE_COLORS: Record<string, string> = {
  CREATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  UPDATE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  VALIDATE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  REJECT: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  EXPORT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
};

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function formatTimestamp(ts: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  try {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);

    if (diffMins < 1) return t('justNow');
    if (diffMins < 60) return t('minutesAgo', { count: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('hoursAgo', { count: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return t('daysAgo', { count: diffDays });

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function formatFullTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

function groupEntriesByDate(entries: AuditEntry[], t: (key: string, params?: Record<string, string | number>) => string): Record<string, AuditEntry[]> {
  const groups: Record<string, AuditEntry[]> = {};
  for (const entry of entries) {
    try {
      const date = new Date(entry.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let label: string;
      if (date.toDateString() === today.toDateString()) {
        label = t('today');
      } else if (date.toDateString() === yesterday.toDateString()) {
        label = t('yesterday');
      } else {
        label = date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
        });
      }
      if (!groups[label]) groups[label] = [];
      groups[label].push(entry);
    } catch {
      const fallback = 'Unknown Date';
      if (!groups[fallback]) groups[fallback] = [];
      groups[fallback].push(entry);
    }
  }
  return groups;
}

function humanizeEntityType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeAction(action: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const map: Record<string, string> = {
    CREATE: t('created'),
    UPDATE: t('updated'),
    DELETE: t('deleted'),
    VALIDATE: t('validated'),
    REJECT: t('rejected'),
    EXPORT: t('exported'),
  };
  return map[action] ?? action.toLowerCase();
}

/* ─── Main Page ─────────────────────────────────────────────────────────────── */

export default function AuditLogPage() {
  const t = useTranslations('settings');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const limit = 20;

  const ACTION_OPTIONS = [
    { value: '', label: t('allActions'), icon: Activity },
    { value: 'CREATE', label: t('actionCreate'), icon: FileText },
    { value: 'UPDATE', label: t('actionUpdate'), icon: Settings },
    { value: 'DELETE', label: t('actionDelete'), icon: Trash2 },
    { value: 'VALIDATE', label: t('actionValidate'), icon: CheckCircle },
    { value: 'REJECT', label: t('actionReject'), icon: XCircle },
    { value: 'EXPORT', label: t('actionExport'), icon: Upload },
  ];

  const ENTITY_TYPE_OPTIONS = [
    { value: '', label: t('allEntities'), icon: Database },
    { value: 'health_event', label: t('healthEvents'), icon: Activity },
    { value: 'vaccination', label: t('vaccinations'), icon: Shield },
    { value: 'lab_result', label: t('labResults'), icon: FileText },
    { value: 'census', label: t('census'), icon: Database },
    { value: 'trade_flow', label: t('tradeFlows'), icon: Upload },
    { value: 'sps_certificate', label: t('spsCertificates'), icon: FileText },
    { value: 'user', label: t('usersManagement'), icon: User },
    { value: 'config', label: t('configuration'), icon: Settings },
  ];

  const { data, isLoading, isError } = useAuditLog({
    page,
    limit,
    action: actionFilter || undefined,
    entityType: entityTypeFilter || undefined,
    search: search || undefined,
  });

  const entries = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit };
  const totalPages = Math.max(1, Math.ceil(meta.total / limit));
  const hasEntries = entries.length > 0;
  const hasActiveFilters = !!actionFilter || !!entityTypeFilter || !!search;

  const dateGroups = useMemo(() => groupEntriesByDate(entries, t), [entries, t]);

  // Summary stats
  const stats = useMemo(() => {
    const byAction: Record<string, number> = {};
    for (const e of entries) {
      byAction[e.action] = (byAction[e.action] ?? 0) + 1;
    }
    return byAction;
  }, [entries]);

  const clearFilters = () => {
    setSearch('');
    setActionFilter('');
    setEntityTypeFilter('');
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-sm">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('auditLogTitle')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('auditLogSubtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-800 dark:bg-violet-900/20">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-violet-900 dark:text-violet-200">
              {t('complianceTraceability')}
            </p>
            <p className="mt-0.5 text-xs text-violet-700 dark:text-violet-400">
              {t('complianceDesc')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[t('actionCreate'), t('actionUpdate'), t('actionDelete'), t('actionValidate'), t('actionReject'), t('actionExport')].map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Stats ── */}
      {hasEntries && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            <Activity className="h-3.5 w-3.5" />
            {t('activityOverview')}
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {(['CREATE', 'UPDATE', 'DELETE', 'VALIDATE', 'REJECT', 'EXPORT'] as const).map((action) => {
              const style = ACTION_STYLES[action];
              const Icon = style.icon;
              const count = stats[action] ?? 0;
              const isActive = actionFilter === action;
              return (
                <button
                  key={action}
                  onClick={() => {
                    setActionFilter(isActive ? '' : action);
                    setPage(1);
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                    isActive
                      ? 'border-violet-300 bg-violet-50 ring-1 ring-violet-200 dark:border-violet-700 dark:bg-violet-900/20 dark:ring-violet-800'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900/50 dark:hover:border-gray-600',
                  )}
                >
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', style.bg)}>
                    <Icon className={cn('h-4 w-4', style.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                      {count}
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {action}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Filters ── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          <Filter className="h-3.5 w-3.5" />
          {t('searchFilter')}
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        </h2>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/50">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('searchAuditPlaceholder')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-300 dark:focus:border-violet-700 transition-colors"
              />
            </div>

            {/* Action filter */}
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-300 dark:focus:border-violet-700 transition-colors"
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Entity type filter */}
            <select
              value={entityTypeFilter}
              onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-300 dark:focus:border-violet-700 transition-colors"
            >
              {ENTITY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                {t('clear')}
              </button>
            )}
          </div>

          {/* Active filters chips */}
          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 dark:border-gray-800 pt-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Active:</span>
              {search && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/30 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                  <Search className="h-3 w-3" />
                  &ldquo;{search}&rdquo;
                  <button onClick={() => { setSearch(''); setPage(1); }} className="ml-0.5 hover:text-violet-900 dark:hover:text-violet-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {actionFilter && (
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', ACTION_BADGE_COLORS[actionFilter])}>
                  {actionFilter}
                  <button onClick={() => { setActionFilter(''); setPage(1); }} className="ml-0.5 opacity-70 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {entityTypeFilter && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                  {humanizeEntityType(entityTypeFilter)}
                  <button onClick={() => { setEntityTypeFilter(''); setPage(1); }} className="ml-0.5 opacity-70 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Timeline ── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          <Clock className="h-3.5 w-3.5" />
          {t('activityTimeline')}
          {meta.total > 0 && (
            <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
              {meta.total.toLocaleString()}
            </span>
          )}
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        </h2>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
              <p className="text-sm text-gray-400">{t('loadingAuditEntries')}</p>
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t('failedToLoadAudit')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('failedToLoadAuditDesc')}</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !isError && !hasEntries && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <ClipboardList className="h-7 w-7 text-gray-300 dark:text-gray-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('noAuditEntries')}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {hasActiveFilters
                    ? t('noAuditEntriesFilterDesc')
                    : t('auditAutoGenerated')}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('clearAllFilters')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Timeline entries grouped by date */}
          {!isLoading && !isError && hasEntries && (
            <div>
              {Object.entries(dateGroups).map(([dateLabel, groupEntries]) => (
                <div key={dateLabel}>
                  {/* Date header */}
                  <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/90 dark:bg-gray-800/90 backdrop-blur-sm px-4 py-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                      {dateLabel}
                    </span>
                    <span className="rounded-full bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                      {groupEntries.length}
                    </span>
                  </div>

                  {/* Entries */}
                  <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {groupEntries.map((entry) => (
                      <AuditEntryRow
                        key={entry.id}
                        entry={entry}
                        expanded={expandedEntry === entry.id}
                        onToggle={() => setExpandedEntry(
                          expandedEntry === entry.id ? null : entry.id,
                        )}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Pagination ── */}
      {meta.total > limit && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('showingEntries', { from: (page - 1) * limit + 1, to: Math.min(page * limit, meta.total), total: meta.total })}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="rounded-lg px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {t('first')}
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {/* Page numbers */}
            {generatePageNumbers(page, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-400">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                    page === p
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
                  )}
                >
                  {p}
                </button>
              ),
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="rounded-lg px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {t('last')}
            </button>
          </div>
        </div>
      )}

      {/* ── Data Classification Legend ── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          <Shield className="h-3.5 w-3.5" />
          {t('dataClassification')}
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {([
            { level: 'PUBLIC', desc: t('classPublic'), icon: Eye },
            { level: 'PARTNER', desc: t('classPartner'), icon: User },
            { level: 'RESTRICTED', desc: t('classRestricted'), icon: AlertTriangle },
            { level: 'CONFIDENTIAL', desc: t('classConfidential'), icon: Shield },
          ] as const).map(({ level, desc, icon: Icon }) => (
            <div
              key={level}
              className={cn(
                'rounded-xl border p-3 transition-colors',
                CLASSIFICATION_COLORS[level],
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-xs font-bold uppercase tracking-wider">{level}</span>
              </div>
              <p className="mt-1 text-[11px] opacity-80">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─── Entry Row ─────────────────────────────────────────────────────────────── */

function AuditEntryRow({
  entry,
  expanded,
  onToggle,
  t,
}: {
  entry: AuditEntry;
  expanded: boolean;
  onToggle: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const style = ACTION_STYLES[entry.action] ?? {
    color: 'text-gray-500',
    bg: 'bg-gray-100 dark:bg-gray-800',
    icon: Settings,
  };
  const Icon = style.icon;
  const badgeColor = ACTION_BADGE_COLORS[entry.action] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  const classColor = CLASSIFICATION_COLORS[entry.dataClassification] ?? '';

  return (
    <div className="group">
      <div
        onClick={onToggle}
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors"
      >
        {/* Action Icon */}
        <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', style.bg)}>
          <Icon className={cn('h-4 w-4', style.color)} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-900 dark:text-white leading-snug">
            <span className="font-semibold">{entry.actor.email}</span>{' '}
            <span className="text-gray-500 dark:text-gray-400">
              {humanizeAction(entry.action, t)}
            </span>{' '}
            <span className="font-medium">
              {humanizeEntityType(entry.entityType)}
            </span>
            {entry.entityId && (
              <span className="ml-1 rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-mono text-gray-500 dark:text-gray-400">
                {entry.entityId.substring(0, 8)}
              </span>
            )}
          </p>

          {entry.reason && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 italic leading-relaxed">
              &ldquo;{entry.reason}&rdquo;
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
              <Clock className="h-3 w-3" />
              {formatTimestamp(entry.timestamp, t)}
            </span>
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium', classColor)}>
              <Shield className="h-2.5 w-2.5" />
              {entry.dataClassification}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
              <User className="h-3 w-3" />
              {entry.actor.role.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Right side: action badge + expand */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider', badgeColor)}>
            {entry.action}
          </span>
          <div className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 px-4 py-3 ml-16">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailField label={t('fullTimestamp')} value={formatFullTimestamp(entry.timestamp)} />
            <DetailField label={t('entityId')} value={entry.entityId} mono />
            <DetailField label={t('actorId')} value={entry.actor.userId} mono />
            <DetailField label="Tenant ID" value={entry.actor.tenantId} mono />
            <DetailField label={t('action')} value={entry.action} />
            <DetailField label={t('entityType')} value={humanizeEntityType(entry.entityType)} />
            <DetailField label={t('actorRole')} value={entry.actor.role.replace(/_/g, ' ')} />
            <DetailField label={t('classification')} value={entry.dataClassification} />
          </div>
          {entry.reason && (
            <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{t('reason')}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{entry.reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Detail Field ──────────────────────────────────────────────────────────── */

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <p className={cn(
        'mt-0.5 text-sm text-gray-700 dark:text-gray-300 truncate',
        mono && 'font-mono text-xs',
      )}>
        {value || '—'}
      </p>
    </div>
  );
}

/* ─── Page Number Generator ─────────────────────────────────────────────────── */

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('...');
  pages.push(total);

  return pages;
}
