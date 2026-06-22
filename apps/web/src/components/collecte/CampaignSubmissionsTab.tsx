'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Eye,
  Inbox,
  Search,
  CheckCircle2,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCampaignSubmissions } from '@/lib/api/workflow-hooks';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { exportToCsv, type CsvColumn } from '@/lib/export/csv';
import { useTranslations } from '@/lib/i18n/translations';

/* ── Status badge styles ─────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, { bg: string; dot: string }> = {
  SUBMITTED: { bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', dot: 'bg-blue-500' },
  VALIDATED: { bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500' },
  REJECTED:  { bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
  DRAFT:     { bg: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400', dot: 'bg-gray-400' },
};

const STATUS_OPTIONS = ['ALL', 'SUBMITTED', 'VALIDATED', 'REJECTED'] as const;

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', dot: 'bg-gray-400' };
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', s.bg)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {label}
    </span>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '--';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso?.slice(0, 10) ?? '--';
  }
}

/* ── Main component ──────────────────────────────────────────────────────── */

interface CampaignSubmissionsTabProps {
  campaignId: string;
}

export default function CampaignSubmissionsTab({ campaignId }: CampaignSubmissionsTabProps) {
  const t = useTranslations('collecte');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');

  const { data: response, isLoading } = useCampaignSubmissions(campaignId, {
    page,
    limit,
    status: statusFilter,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissions: any[] = response?.data ?? [];
  const total: number = response?.meta?.total ?? 0;

  // Fetch all submissions for export (large limit)
  const { data: allResponse } = useCampaignSubmissions(campaignId, {
    page: 1,
    limit: 10000,
  });
  const allSubmissions: any[] = allResponse?.data ?? [];

  const handleExportCsv = useCallback(() => {
    const rows = allSubmissions.length > 0 ? allSubmissions : submissions;
    if (rows.length === 0) return;

    // Collect all unique data keys across all submissions
    const dataKeys = new Set<string>();
    rows.forEach((s) => {
      if (s.data && typeof s.data === 'object') {
        Object.keys(s.data).forEach((k) => dataKeys.add(k));
      }
    });

    // Build columns: fixed columns first, then dynamic data columns
    const columns: CsvColumn<any>[] = [
      { key: (r) => r.id ?? '', header: 'ID' },
      { key: (r) => r.status ?? '', header: 'Status' },
      { key: (r) => (r.submittedBy ?? r.userId ?? ''), header: 'Submitted By' },
      { key: (r) => r.submittedAt ?? r.createdAt ?? '', header: 'Date' },
      { key: (r) => r.campaignId ?? '', header: 'Campaign ID' },
    ];

    // Add data field columns
    const sortedDataKeys = Array.from(dataKeys).sort();
    sortedDataKeys.forEach((key) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      columns.push({
        key: (r) => {
          const val = r.data?.[key];
          if (val == null) return '';
          if (typeof val === 'object') return JSON.stringify(val);
          return String(val);
        },
        header: label,
      });
    });

    exportToCsv(rows, columns, `campaign-${campaignId}-submissions`);
  }, [allSubmissions, submissions, campaignId]);

  // Client-side search filter (by ID or submittedBy)
  const filtered = search.trim()
    ? submissions.filter((s) => {
        const q = search.toLowerCase();
        return (
          s.id?.toLowerCase().includes(q) ||
          s.submittedBy?.toLowerCase().includes(q) ||
          s.userId?.toLowerCase().includes(q)
        );
      })
    : submissions;

  if (isLoading) {
    return <TableSkeleton rows={5} cols={6} />;
  }

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status filter */}
        <select
          value={statusFilter ?? 'ALL'}
          onChange={(e) => {
            const v = e.target.value;
            setStatusFilter(v === 'ALL' ? undefined : v);
            setPage(1);
          }}
          className="appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? t('allStatuses') : s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchCampaigns')}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:placeholder-gray-500"
          />
        </div>

        {/* Export */}
        <ExportMenu onExportCsv={handleExportCsv} disabled={total === 0} />
      </div>

      {/* Table or empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 dark:border-gray-700 dark:bg-gray-900">
          <Inbox className="h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">
            {t('noSubmissionsYet')}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('noSubmissionsDesc')}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                  <th className="px-4 py-3">{t('submissionId')}</th>
                  <th className="px-4 py-3">{t('status')}</th>
                  <th className="px-4 py-3">{t('submittedBy')}</th>
                  <th className="px-4 py-3">{t('submittedDate')}</th>
                  <th className="px-4 py-3">{t('qualityStatus')}</th>
                  <th className="px-4 py-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-mono text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
                        {sub.id?.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        {(sub.submittedBy ?? sub.userId ?? '--').slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(sub.submittedAt ?? sub.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {sub.qualityReportId ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Minus className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/collecte/submissions/${sub.id}/review`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {t('viewSubmission')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <Pagination
              page={page}
              total={total}
              limit={limit}
              onPageChange={(p) => setPage(p)}
              onLimitChange={(l) => { setLimit(l); setPage(1); }}
            />
          )}
        </div>
      )}
    </div>
  );
}
