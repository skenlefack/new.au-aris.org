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
  Filter,
  RotateCcw,
  Eye,
  AlertTriangle,
  Shield,
  X,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useWorkflowItems,
  useWorkflowAction,
  useWorkflowDashboard,
  useWorkflowDetail,
  type WorkflowItem,
  type WorkflowLevel,
  type WorkflowStatus,
} from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { useTranslations } from '@/lib/i18n/translations';

/* ── Constants ────────────────────────────────────────────────────────────── */

const LEVEL_CONFIG: Record<WorkflowLevel, { label: string; shortLabel: string; dot: string; color: string; order: number }> = {
  NATIONAL_TECHNICAL:       { label: 'level1', shortLabel: 'L1', dot: 'bg-blue-500',   color: 'text-blue-700 dark:text-blue-400', order: 1 },
  NATIONAL_OFFICIAL:        { label: 'level2', shortLabel: 'L2', dot: 'bg-green-500',  color: 'text-green-700 dark:text-green-400', order: 2 },
  REC_HARMONIZATION:        { label: 'level3', shortLabel: 'L3', dot: 'bg-orange-500', color: 'text-orange-700 dark:text-orange-400', order: 3 },
  CONTINENTAL_PUBLICATION:  { label: 'level4', shortLabel: 'L4', dot: 'bg-purple-500', color: 'text-purple-700 dark:text-purple-400', order: 4 },
};

const STATUS_STYLES: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  IN_REVIEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  APPROVED:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  RETURNED:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  ESCALATED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const DOMAIN_CONFIG: Record<string, { label: string; badge: string }> = {
  health:     { label: 'Animal Health',   badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' },
  livestock:  { label: 'Livestock',       badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' },
  fisheries:  { label: 'Fisheries',       badge: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800' },
  wildlife:   { label: 'Wildlife',        badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' },
  apiculture: { label: 'Apiculture',      badge: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800' },
  trade:      { label: 'Trade & SPS',     badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800' },
  governance: { label: 'Governance',      badge: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800' },
  climate:    { label: 'Climate & Env',   badge: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800' },
  collecte:   { label: 'Collecte',        badge: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800' },
};

const ALL_LEVELS: WorkflowLevel[] = ['NATIONAL_TECHNICAL', 'NATIONAL_OFFICIAL', 'REC_HARMONIZATION', 'CONTINENTAL_PUBLICATION'];
const ALL_STATUSES: WorkflowStatus[] = ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED', 'ESCALATED'];

const PAGE_SIZE = 10;

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-EG' : locale, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso?.slice(0, 10) ?? '—';
  }
}

function formatDateTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale === 'ar' ? 'ar-EG' : locale, {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso?.slice(0, 16) ?? '—';
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bIn Review\b/, 'In Review');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/* ── Detail Modal ─────────────────────────────────────────────────────────── */

function DetailModal({
  item,
  onClose,
  t,
}: {
  item: WorkflowItem;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const { data: detail } = useWorkflowDetail(item.id);
  const instance = detail?.data ?? item;
  const transitions = instance.transitions ?? [];
  const level = LEVEL_CONFIG[instance.currentLevel] ?? LEVEL_CONFIG.NATIONAL_TECHNICAL;
  const domain = DOMAIN_CONFIG[instance.domain] ?? { label: capitalize(instance.domain), badge: 'bg-gray-50 text-gray-700 border-gray-200' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('workflowInstance')}</h2>
            <p className="mt-0.5 text-xs text-gray-500 font-mono">{instance.id.slice(0, 8)}...</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Domain</p>
            <span className={cn('mt-1 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', domain.badge)}>
              {domain.label}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('colType')}</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">{capitalize(instance.entityType)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('currentStep')}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', level.dot)} />
              <span className={cn('text-sm font-medium', level.color)}>{level.shortLabel} - {t(level.label)}</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('status')}</p>
            <span className={cn('mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLES[instance.status] ?? 'bg-gray-100 text-gray-700')}>
              {statusLabel(instance.status)}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('date')}</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDateTime(instance.createdAt, 'en')}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('deadline')}</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">
              {instance.slaDeadline ? formatDateTime(instance.slaDeadline, 'en') : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">WAHIS Ready</p>
            <p className="mt-1 text-sm">
              {instance.wahisReady
                ? <span className="text-green-600 font-medium">Yes</span>
                : <span className="text-gray-400">No</span>}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Analytics Ready</p>
            <p className="mt-1 text-sm">
              {instance.analyticsReady
                ? <span className="text-green-600 font-medium">Yes</span>
                : <span className="text-gray-400">No</span>}
            </p>
          </div>
        </div>

        {/* Timeline */}
        {transitions.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{t('validationTimeline')}</h3>
            <div className="space-y-3">
              {transitions.map((tr, idx) => (
                <div key={tr.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-white text-xs font-bold',
                      tr.action === 'APPROVE' ? 'bg-green-500' :
                      tr.action === 'REJECT' ? 'bg-red-500' :
                      tr.action === 'RETURN' ? 'bg-orange-500' :
                      tr.action === 'ESCALATE' ? 'bg-purple-500' :
                      'bg-blue-500',
                    )}>
                      {tr.action === 'APPROVE' ? <CheckCircle className="h-3.5 w-3.5" /> :
                       tr.action === 'REJECT' ? <XCircle className="h-3.5 w-3.5" /> :
                       tr.action === 'RETURN' ? <RotateCcw className="h-3.5 w-3.5" /> :
                       <ArrowRight className="h-3.5 w-3.5" />}
                    </div>
                    {idx < transitions.length - 1 && <div className="mt-1 h-full w-0.5 bg-gray-200 dark:bg-gray-700" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {t(`action${tr.action.charAt(0) + tr.action.slice(1).toLowerCase()}` as string) || capitalize(tr.action)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {LEVEL_CONFIG[tr.fromLevel]?.shortLabel ?? '?'} <ArrowRight className="inline h-3 w-3" /> {LEVEL_CONFIG[tr.toLevel]?.shortLabel ?? '?'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {tr.actorRole} - {formatDateTime(tr.createdAt, 'en')}
                    </p>
                    {tr.comment && (
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 italic">&ldquo;{tr.comment}&rdquo;</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Action Dialog ────────────────────────────────────────────────────────── */

function ActionDialog({
  item,
  action,
  onClose,
  onConfirm,
  isPending,
  t,
}: {
  item: WorkflowItem;
  action: 'approve' | 'reject' | 'return';
  onClose: () => void;
  onConfirm: (text: string) => void;
  isPending: boolean;
  t: (key: string) => string;
}) {
  const [text, setText] = useState('');
  const isReasonRequired = action === 'reject' || action === 'return';
  const canSubmit = !isReasonRequired || text.trim().length > 0;

  const titleMap = { approve: t('validateSubmission'), reject: t('rejectSubmission'), return: t('returnForCorrection') };
  const placeholderMap = { approve: t('addCommentPlaceholder'), reject: t('reasonForRejection'), return: t('whatNeedsCorrecting') };
  const btnClass = { approve: 'bg-green-600 hover:bg-green-700', reject: 'bg-red-600 hover:bg-red-700', return: 'bg-orange-600 hover:bg-orange-700' };
  const btnLabel = { approve: t('validateAndAdvance'), reject: t('reject'), return: t('returnForCorrection') };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{titleMap[action]}</h3>
        <p className="mt-1 text-sm text-gray-500">
          ID: <span className="font-mono">{item.id.slice(0, 8)}...</span> — {DOMAIN_CONFIG[item.domain]?.label ?? capitalize(item.domain)}
        </p>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {isReasonRequired ? t('reason') : t('commentLabel')}
            {isReasonRequired ? <span className="text-red-500 ml-1">*</span> : <span className="text-gray-400 ml-1">{t('commentOptional')}</span>}
          </label>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholderMap[action]}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
            {t('cancel')}
          </button>
          <button
            onClick={() => onConfirm(text)}
            disabled={isPending || !canSubmit}
            className={cn('rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50', btnClass[action])}
          >
            {isPending ? t('processing') : btnLabel[action]}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */

export default function WorkflowPage() {
  const t = useTranslations('workflow');

  /* ---- state ---- */
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [domainFilter, setDomainFilter] = useState<string | undefined>(undefined);
  const [viewingItem, setViewingItem] = useState<WorkflowItem | null>(null);
  const [actionDialog, setActionDialog] = useState<{ item: WorkflowItem; action: 'approve' | 'reject' | 'return' } | null>(null);

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
    domain: domainFilter,
  });

  const { data: dashboardRes } = useWorkflowDashboard();
  const dashboard = dashboardRes?.data;

  const workflowAction = useWorkflowAction();

  /* ---- derived data ---- */
  const items = response?.data ?? [];
  const apiMeta = response?.meta;
  const total = apiMeta?.total ?? items.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  /* ---- action handler ---- */
  function handleAction(id: string, action: 'approve' | 'reject' | 'return', text: string) {
    workflowAction.mutate(
      {
        id,
        action,
        ...(action === 'approve' ? { comment: text } : { reason: text }),
      },
      { onSuccess: () => setActionDialog(null) },
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('pendingValidation')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{dashboard?.totalPending ?? 0}</p>
            </div>
          </div>
          {dashboard?.pendingByLevel && (
            <div className="mt-3 flex flex-wrap gap-2">
              {ALL_LEVELS.map((lvl) => {
                const count = dashboard.pendingByLevel[lvl] ?? 0;
                if (!count) return null;
                const cfg = LEVEL_CONFIG[lvl];
                return (
                  <span key={lvl} className={cn('inline-flex items-center gap-1 text-xs font-medium', cfg.color)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                    {cfg.shortLabel}: {count}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('approve') + 'd'}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{dashboard?.totalApproved ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">SLA {t('overdue')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{dashboard?.slaBreaches ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">WAHIS Ready</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{dashboard?.wahisReadyCount ?? 0}</p>
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
            onChange={(e) => { setLevelFilter(e.target.value || undefined); setPage(1); }}
            className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="">{t('allLevels')}</option>
            {ALL_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>{t(LEVEL_CONFIG[lvl].label)}</option>
            ))}
          </select>
        </div>

        <select
          value={statusFilter ?? ''}
          onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1); }}
          className="appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">{t('allStatuses')}</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>

        <select
          value={domainFilter ?? ''}
          onChange={(e) => { setDomainFilter(e.target.value || undefined); setPage(1); }}
          className="appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">{t('allTypes')}</option>
          {Object.entries(DOMAIN_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : isError ? (
        <QueryError message="Failed to load workflow items" onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 dark:border-gray-700 dark:bg-gray-900">
          <Inbox className="h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">
            {t('noItems')}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {levelFilter || statusFilter || domainFilter
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
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">{t('colType')}</th>
                  <th className="px-4 py-3">{t('colLevel')}</th>
                  <th className="px-4 py-3">{t('colStatus')}</th>
                  <th className="px-4 py-3">{t('colDate')}</th>
                  <th className="px-4 py-3">{t('deadline')}</th>
                  <th className="px-4 py-3 text-right">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((item) => {
                  const level = LEVEL_CONFIG[item.currentLevel] ?? LEVEL_CONFIG.NATIONAL_TECHNICAL;
                  const domain = DOMAIN_CONFIG[item.domain] ?? { label: capitalize(item.domain), badge: 'bg-gray-50 text-gray-700 border-gray-200' };
                  const isActionable = item.status === 'PENDING' || item.status === 'IN_REVIEW' || item.status === 'RETURNED';
                  const isOverdue = item.slaDeadline && new Date(item.slaDeadline) < new Date() && isActionable;

                  return (
                    <tr key={item.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-800/50', isOverdue && 'bg-red-50/30 dark:bg-red-900/5')}>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', domain.badge)}>
                          {domain.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {capitalize(item.entityType)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('h-2 w-2 rounded-full', level.dot)} />
                          <span className={cn('text-xs font-medium', level.color)}>{level.shortLabel}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLES[item.status] ?? 'bg-gray-100 text-gray-700')}>
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDate(item.createdAt, 'en')}</td>
                      <td className="px-4 py-3">
                        {item.slaDeadline ? (
                          <span className={cn('text-xs', isOverdue ? 'text-red-600 font-medium' : 'text-gray-500 dark:text-gray-400')}>
                            {isOverdue && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                            {formatDate(item.slaDeadline, 'en')}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View button — always visible */}
                          <button
                            onClick={() => setViewingItem(item)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                            title={t('view')}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {t('view')}
                          </button>

                          {/* Action buttons — only for actionable statuses */}
                          {isActionable && (
                            <>
                              <button
                                onClick={() => setActionDialog({ item, action: 'approve' })}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                {t('approve')}
                              </button>
                              <button
                                onClick={() => setActionDialog({ item, action: 'reject' })}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                {t('reject')}
                              </button>
                              <button
                                onClick={() => setActionDialog({ item, action: 'return' })}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                {t('returnAction')}
                              </button>
                            </>
                          )}
                        </div>
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

      {/* Detail Modal */}
      {viewingItem && (
        <DetailModal item={viewingItem} onClose={() => setViewingItem(null)} t={t} />
      )}

      {/* Action Dialog */}
      {actionDialog && (
        <ActionDialog
          item={actionDialog.item}
          action={actionDialog.action}
          onClose={() => setActionDialog(null)}
          onConfirm={(text) => handleAction(actionDialog.item.id, actionDialog.action, text)}
          isPending={workflowAction.isPending}
          t={t}
        />
      )}
    </div>
  );
}
