'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReportsV2, type ReportStatus, type ReportType } from '@/lib/api/report-hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_TABS: Array<{ key: ReportStatus | 'ALL'; tKey: string }> = [
  { key: 'ALL', tKey: 'tabAll' },
  { key: 'DRAFT', tKey: 'tabDraft' },
  { key: 'GENERATING', tKey: 'tabGenerating' },
  { key: 'AWAITING_REVIEW', tKey: 'tabAwaitingReview' },
  { key: 'PUBLISHED', tKey: 'tabPublished' },
  { key: 'FAILED', tKey: 'tabFailed' },
];

const STATUS_BADGE: Record<ReportStatus, { color: string; icon: React.ReactNode; tKey: string }> = {
  DRAFT: {
    color: 'bg-gray-100 text-gray-700',
    icon: <Clock className="h-3 w-3" />,
    tKey: 'statusDraft',
  },
  GENERATING: {
    color: 'bg-blue-100 text-blue-700',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    tKey: 'statusGenerating',
  },
  AWAITING_REVIEW: {
    color: 'bg-amber-100 text-amber-700',
    icon: <Eye className="h-3 w-3" />,
    tKey: 'statusAwaitingReview',
  },
  PUBLISHED: {
    color: 'bg-green-100 text-green-700',
    icon: <CheckCircle2 className="h-3 w-3" />,
    tKey: 'statusPublished',
  },
  FAILED: {
    color: 'bg-red-100 text-red-700',
    icon: <XCircle className="h-3 w-3" />,
    tKey: 'statusFailed',
  },
};

const TYPE_BADGE: Record<ReportType, string> = {
  PERIODIC: 'bg-indigo-100 text-indigo-700',
  AD_HOC: 'bg-purple-100 text-purple-700',
  FLASH: 'bg-orange-100 text-orange-700',
};

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function ReportsPage() {
  const t = useTranslations('reports');
  const locale = useLocaleStore((s) => s.locale);

  const [activeTab, setActiveTab] = useState<ReportStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<ReportType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useReportsV2({
    status: activeTab === 'ALL' ? undefined : activeTab,
    type: typeFilter || undefined,
    page,
    limit,
  });

  const reports = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;

  // Client-side search filter (backend doesn't have search param in current API)
  const filtered = searchQuery
    ? reports.filter((r) => {
        const title = locale === 'fr' ? r.titleFr : r.titleEn;
        return title.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : reports;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('subtitle')}
          </p>
        </div>
        <Link
          href="/reports/generate"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a4268] transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('generateNew')}
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className={cn(
                'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-[#1F4E79] text-[#1F4E79]'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              )}
            >
              {t(tab.tKey)}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchReports')}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value as ReportType | ''); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{t('allTypes')}</option>
          <option value="PERIODIC">{t('typePeriodic')}</option>
          <option value="AD_HOC">{t('typeAdHoc')}</option>
          <option value="FLASH">{t('typeFlash')}</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <FileText className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
            {t('noReportsYet')}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('noReportsDesc')}
          </p>
          <Link
            href="/reports/generate"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a4268]"
          >
            <Plus className="h-4 w-4" />
            {t('generateNew')}
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    {t('colTitle')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    {t('colType')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    {t('colPeriod')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    {t('colScope')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    {t('colStatus')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    {t('colDate')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                    {t('colActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filtered.map((report) => {
                  const title = locale === 'fr' ? report.titleFr : report.titleEn;
                  const statusCfg = STATUS_BADGE[report.status] ?? STATUS_BADGE.DRAFT;
                  const typeBadge = TYPE_BADGE[report.type] ?? 'bg-gray-100 text-gray-600';

                  return (
                    <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/reports/${report.id}`}
                          className="font-medium text-gray-900 hover:text-[#1F4E79] dark:text-white"
                        >
                          {title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider', typeBadge)}>
                          {report.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        <span className="text-xs">
                          {new Date(report.periodStart).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { month: 'short', year: 'numeric' })}
                          {' - '}
                          {new Date(report.periodEnd).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { month: 'short', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {report.scope}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', statusCfg.color)}>
                          {statusCfg.icon}
                          {t(statusCfg.tKey)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {report.createdAt
                          ? new Date(report.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '--'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/reports/${report.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t('view')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total > meta.limit && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('showingReports', {
              from: (meta.page - 1) * meta.limit + 1,
              to: Math.min(meta.page * meta.limit, meta.total),
              total: meta.total,
            })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t('previous')}
            </button>
            <span className="px-2 text-xs text-gray-500">
              {t('pageOf', { page, total: totalPages })}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
            >
              {t('next')}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
