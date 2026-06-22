'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Eye,
  Inbox,
  Search,
  CheckCircle2,
  Minus,
  AlertTriangle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCampaignSubmissions, useResolveConflict } from '@/lib/api/workflow-hooks';
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
  CONFLICT:  { bg: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', dot: 'bg-orange-500' },
};

const STATUS_OPTIONS = ['ALL', 'SUBMITTED', 'VALIDATED', 'REJECTED', 'CONFLICT'] as const;

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

/* ── Conflict Resolution Dialog ──────────────────────────────────────────── */

interface ConflictDialogProps {
  submission: any;
  onClose: () => void;
  onResolved: () => void;
}

function ConflictResolutionDialog({ submission, onClose, onResolved }: ConflictDialogProps) {
  const t = useTranslations('collecte');
  const resolve = useResolveConflict();
  const [resolution, setResolution] = useState<'KEEP_SERVER' | 'KEEP_CLIENT' | 'MERGE'>('KEEP_SERVER');
  const [mergedData, setMergedData] = useState('');
  const [error, setError] = useState('');

  const serverData = submission.data ?? {};
  const clientData = submission.conflictClientData ?? {};

  // Collect all keys
  const allKeys = Array.from(new Set([
    ...Object.keys(serverData),
    ...Object.keys(clientData),
  ])).sort();

  // Find differing keys
  const diffKeys = allKeys.filter(
    (k) => JSON.stringify(serverData[k]) !== JSON.stringify(clientData[k]),
  );

  const handleResolve = async () => {
    setError('');
    try {
      let merged: Record<string, unknown> | undefined;
      if (resolution === 'MERGE') {
        if (!mergedData.trim()) {
          setError(t('mergedDataRequired'));
          return;
        }
        try {
          merged = JSON.parse(mergedData);
        } catch {
          setError(t('invalidJson'));
          return;
        }
      }

      await resolve.mutateAsync({
        id: submission.id,
        resolution,
        mergedData: merged,
      });
      onResolved();
    } catch (err: any) {
      setError(err.message ?? 'Failed to resolve conflict');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-4xl rounded-xl bg-white shadow-2xl dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('resolveConflict')}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Side-by-side data comparison */}
        <div className="px-6 py-4">
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            {t('conflictDescription')}
          </p>

          <div className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            {t('serverVersion')}: v{submission.version} | {t('clientVersion')}: v{submission.conflictClientVersion ?? '?'}
            {submission.conflictDetectedAt && (
              <> | {t('detectedAt')}: {formatDate(submission.conflictDetectedAt)}</>
            )}
          </div>

          {diffKeys.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                    <th className="px-4 py-2">{t('field')}</th>
                    <th className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20">{t('serverValue')}</th>
                    <th className="px-4 py-2 bg-orange-50 dark:bg-orange-900/20">{t('clientValue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {diffKeys.map((key) => (
                    <tr key={key}>
                      <td className="px-4 py-2 font-mono text-xs font-medium text-gray-700 dark:text-gray-300">
                        {key}
                      </td>
                      <td className="px-4 py-2 bg-blue-50/50 dark:bg-blue-900/10 text-xs break-all">
                        {JSON.stringify(serverData[key] ?? null)}
                      </td>
                      <td className="px-4 py-2 bg-orange-50/50 dark:bg-orange-900/10 text-xs break-all">
                        {JSON.stringify(clientData[key] ?? null)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">{t('noFieldDifferences')}</p>
          )}
        </div>

        {/* Resolution options */}
        <div className="border-t px-6 py-4 dark:border-gray-700">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{t('chooseResolution')}</h3>
          <div className="space-y-2">
            {(['KEEP_SERVER', 'KEEP_CLIENT', 'MERGE'] as const).map((opt) => (
              <label key={opt} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                <input
                  type="radio"
                  name="resolution"
                  value={opt}
                  checked={resolution === opt}
                  onChange={() => setResolution(opt)}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {t(`resolution_${opt}`)}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t(`resolution_${opt}_desc`)}
                  </p>
                </div>
              </label>
            ))}
          </div>

          {resolution === 'MERGE' && (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t('mergedDataJson')}
              </label>
              <textarea
                value={mergedData}
                onChange={(e) => setMergedData(e.target.value)}
                rows={6}
                placeholder='{ "field1": "value1", ... }'
                className="w-full rounded-lg border p-3 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              />
            </div>
          )}

          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t px-6 py-4 dark:border-gray-700">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleResolve}
            disabled={resolve.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {resolve.isPending ? t('resolving') : t('resolveConflictBtn')}
          </button>
        </div>
      </div>
    </div>
  );
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
  const [conflictSub, setConflictSub] = useState<any>(null);

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
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={sub.status} />
                        {sub.conflictStatus === 'PENDING' && (
                          <span title={t('pendingConflict')}><AlertTriangle className="h-4 w-4 text-orange-500" /></span>
                        )}
                      </div>
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
                      <div className="flex items-center justify-end gap-2">
                        {sub.conflictStatus === 'PENDING' && (
                          <button
                            onClick={() => setConflictSub(sub)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20 transition-colors"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {t('resolveConflictBtn')}
                          </button>
                        )}
                        <Link
                          href={`/collecte/submissions/${sub.id}/review`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t('viewSubmission')}
                        </Link>
                      </div>
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

      {/* Conflict Resolution Dialog */}
      {conflictSub && (
        <ConflictResolutionDialog
          submission={conflictSub}
          onClose={() => setConflictSub(null)}
          onResolved={() => setConflictSub(null)}
        />
      )}
    </div>
  );
}
