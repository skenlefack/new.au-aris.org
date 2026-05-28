'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Inbox,
  Timer,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowItems, useWorkflowAction, type WorkflowItem } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { useTranslations } from '@/lib/i18n/translations';

/* ── Constants ────────────────────────────────────────────────────────────── */

const WORKFLOW_LEVELS: Record<number, { dot: string; color: string }> = {
  1: { color: 'text-blue-700', dot: 'bg-blue-500' },
  2: { color: 'text-green-700', dot: 'bg-green-500' },
  3: { color: 'text-orange-700', dot: 'bg-orange-500' },
  4: { color: 'text-purple-700', dot: 'bg-purple-500' },
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  returned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-gray-400',
  medium: 'bg-amber-400',
  high: 'bg-red-500',
};

const PAGE_SIZE = 10;

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-EG' : locale, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/* ── Main Page ────────────────────────────────────────────────────────────── */

export default function WorkflowPage() {
  const t = useTranslations('workflow');

  /* ---- state ---- */
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string | undefined>(undefined);
  const [actionComment, setActionComment] = useState<Record<string, string>>({});
  const [confirmingAction, setConfirmingAction] = useState<{
    id: string;
    action: 'approve' | 'reject' | 'return';
  } | null>(null);

  /* ---- hooks ---- */
  const {
    data: response,
    isLoading,
    isError,
    refetch,
  } = useWorkflowItems({
    page,
    limit: PAGE_SIZE,
    level: levelFilter,
    status: statusFilter,
    entityType: entityTypeFilter,
  });

  const workflowAction = useWorkflowAction();

  /* ---- derived data ---- */
  const apiItems = response?.data ?? [];
  const apiMeta = response?.meta;
  const hasApiData = apiItems.length > 0;

  // Use API data only — no more placeholder/example data
  const filteredItems = useMemo(() => {
    if (!hasApiData) return [];
    return apiItems;
  }, [hasApiData, apiItems]);

  const total = apiMeta?.total ?? filteredItems.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  /* ---- KPI calculations ---- */
  const pendingCount = apiItems.filter((i) => i.status === 'pending').length;
  const approvedThisWeek = apiItems.filter((i) => {
    if (i.status !== 'approved') return false;
    const submitted = new Date(i.submittedAt);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return submitted >= weekAgo;
  }).length;

  /* ---- Entity type label ---- */
  const entityLabel = (type: string) => {
    const map: Record<string, string> = {
      health_event: t('healthEvent'),
      vaccination: t('vaccination'),
      lab_result: t('labResult'),
      census: t('census'),
    };
    return map[type] ?? type;
  };

  const entityBadgeClass = (type: string) => {
    const map: Record<string, string> = {
      health_event: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
      vaccination: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800',
      lab_result: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800',
      census: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    };
    return map[type] ?? 'bg-gray-50 text-gray-700 border-gray-200';
  };

  /* ---- action handler ---- */
  function handleAction(id: string, action: 'approve' | 'reject' | 'return') {
    const comment = actionComment[id] ?? '';
    workflowAction.mutate(
      { id, action, comment },
      {
        onSuccess: () => {
          setConfirmingAction(null);
          setActionComment((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        },
      },
    );
  }

  /* ---- render ---- */
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('pageTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('pageSubtitle')}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('pendingReviews')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingCount}</p>
              </div>
            </div>
            {pendingCount > 0 && (
              <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-amber-500 px-2 text-xs font-semibold text-white">
                {pendingCount}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('approvedThisWeek')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{approvedThisWeek}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <Timer className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('avgProcessingTime')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">—</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={levelFilter ?? ''}
            onChange={(e) => { setLevelFilter(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
            className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="">{t('allLevels')}</option>
            <option value="1">{t('level1')}</option>
            <option value="2">{t('level2')}</option>
            <option value="3">{t('level3')}</option>
            <option value="4">{t('level4')}</option>
          </select>
        </div>

        <select
          value={statusFilter ?? ''}
          onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1); }}
          className="appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">{t('allStatuses')}</option>
          <option value="pending">{t('pending') || 'Pending'}</option>
          <option value="approved">{t('approved') || 'Approved'}</option>
          <option value="rejected">{t('rejected') || 'Rejected'}</option>
          <option value="returned">{t('returnAction')}</option>
        </select>

        <select
          value={entityTypeFilter ?? ''}
          onChange={(e) => { setEntityTypeFilter(e.target.value || undefined); setPage(1); }}
          className="appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">{t('allTypes')}</option>
          <option value="health_event">{t('healthEvent')}</option>
          <option value="vaccination">{t('vaccination')}</option>
          <option value="lab_result">{t('labResult')}</option>
          <option value="census">{t('census')}</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={9} />
      ) : isError ? (
        <QueryError message="Failed to load workflow items" onRetry={() => refetch()} />
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 dark:border-gray-700 dark:bg-gray-900">
          <Inbox className="h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">
            {t('noItems')}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchQuery || levelFilter || statusFilter || entityTypeFilter
              ? t('adjustFilters')
              : t('noItemsHint')}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                  <th className="px-4 py-3">{t('colTitle')}</th>
                  <th className="px-4 py-3">{t('colType')}</th>
                  <th className="px-4 py-3">{t('colCountry')}</th>
                  <th className="px-4 py-3">{t('colSubmittedBy')}</th>
                  <th className="px-4 py-3">{t('colDate')}</th>
                  <th className="px-4 py-3">{t('colLevel')}</th>
                  <th className="px-4 py-3">{t('colPriority')}</th>
                  <th className="px-4 py-3">{t('colStatus')}</th>
                  <th className="px-4 py-3 text-right">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredItems.map((item) => {
                  const level = WORKFLOW_LEVELS[item.currentLevel] ?? WORKFLOW_LEVELS[1];
                  const isConfirming = confirmingAction?.id === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900 dark:text-white">{item.title}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', entityBadgeClass(item.entityType))}>
                          {entityLabel(item.entityType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.country}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.submittedBy}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(item.submittedAt, 'en')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('h-2 w-2 rounded-full', level.dot)} />
                          <span className={cn('text-xs font-medium', level.color)}>L{item.currentLevel}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                          <span className={cn('h-2 w-2 rounded-full', PRIORITY_DOT[item.priority] ?? 'bg-gray-400')} />
                          {item.priority ? item.priority.charAt(0).toUpperCase() + item.priority.slice(1) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLES[item.status] ?? 'bg-gray-100 text-gray-700')}>
                          {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.status === 'pending' ? (
                          isConfirming ? (
                            <div className="flex flex-col items-end gap-2">
                              <input
                                type="text"
                                placeholder={t('addComment')}
                                value={actionComment[item.id] ?? ''}
                                onChange={(e) => setActionComment((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                className="w-48 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                              />
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleAction(item.id, confirmingAction!.action)}
                                  disabled={workflowAction.isPending}
                                  className={cn(
                                    'rounded-md px-2.5 py-1 text-xs font-medium text-white',
                                    confirmingAction!.action === 'approve' ? 'bg-green-600 hover:bg-green-700'
                                      : confirmingAction!.action === 'reject' ? 'bg-red-600 hover:bg-red-700'
                                      : 'bg-blue-600 hover:bg-blue-700',
                                    workflowAction.isPending && 'cursor-not-allowed opacity-50',
                                  )}
                                >
                                  {workflowAction.isPending ? t('processing') : t('confirmAction')}
                                </button>
                                <button
                                  onClick={() => setConfirmingAction(null)}
                                  className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                  {t('cancelAction')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setConfirmingAction({ id: item.id, action: 'approve' })}
                                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                {t('approve')}
                              </button>
                              <button
                                onClick={() => setConfirmingAction({ id: item.id, action: 'reject' })}
                                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                {t('reject')}
                              </button>
                              <button
                                onClick={() => setConfirmingAction({ id: item.id, action: 'return' })}
                                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                {t('returnAction')}
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('showing')}{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">{(page - 1) * PAGE_SIZE + 1}</span>
                {' - '}
                <span className="font-medium text-gray-700 dark:text-gray-300">{Math.min(page * PAGE_SIZE, total)}</span>
                {' '}{t('of')}{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">{total}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('previous')}
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  {t('next')}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
