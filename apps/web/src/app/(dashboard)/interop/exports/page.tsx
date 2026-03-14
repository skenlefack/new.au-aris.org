'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Filter,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useExportHistory, useRetryExport } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-3 w-3" />,
  IN_PROGRESS: <Loader2 className="h-3 w-3 animate-spin" />,
  COMPLETED: <CheckCircle2 className="h-3 w-3" />,
  FAILED: <XCircle className="h-3 w-3" />,
};

const CONNECTOR_COLORS: Record<string, string> = {
  WAHIS: 'bg-blue-100 text-blue-700',
  EMPRES: 'bg-purple-100 text-purple-700',
  FAOSTAT: 'bg-orange-100 text-orange-700',
};

export default function ExportHistoryPage() {
  const t = useTranslations('interop');
  const [page, setPage] = useState(1);
  const [connectorFilter, setConnectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useExportHistory({
    page,
    limit: 20,
    connector: connectorFilter || undefined,
    status: statusFilter || undefined,
  });
  const exports = data?.data ?? [];
  const meta = data?.meta;

  const retryExport = useRetryExport();

  function handleRetry(id: string) {
    retryExport.mutate(id);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/interop"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToInteropHub')}
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-gray-900">{t('exportHistory')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('exportHistoryDesc')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={connectorFilter}
          onChange={(e) => {
            setConnectorFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
        >
          <option value="">{t('allConnectors')}</option>
          <option value="WAHIS">WAHIS</option>
          <option value="EMPRES">EMPRES</option>
          <option value="FAOSTAT">FAOSTAT</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
        >
          <option value="">{t('allStatuses')}</option>
          <option value="PENDING">{t('statusPending')}</option>
          <option value="IN_PROGRESS">{t('statusInProgress')}</option>
          <option value="COMPLETED">{t('statusCompleted')}</option>
          <option value="FAILED">{t('statusFailed')}</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={10} cols={8} />
      ) : (
        <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3">{t('type')}</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">{t('period')}</th>
                <th className="px-4 py-3">{t('format')}</th>
                <th className="px-4 py-3 text-right">Records</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {exports.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
                        CONNECTOR_COLORS[exp.connectorType] ??
                          'bg-gray-100 text-gray-600',
                      )}
                    >
                      {exp.connectorType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {exp.countryCode}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {new Date(exp.periodStart).toLocaleDateString()} &ndash;{' '}
                    {new Date(exp.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono">
                      {exp.format}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {exp.recordCount ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                        STATUS_COLORS[exp.status] ?? 'bg-gray-100 text-gray-600',
                      )}
                    >
                      {STATUS_ICONS[exp.status]}
                      {exp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {exp.exportedAt
                      ? new Date(exp.exportedAt).toLocaleString()
                      : new Date(exp.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {exp.status === 'COMPLETED' && exp.packageUrl && (
                        <a
                          href={exp.packageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-aris-primary-600 hover:text-aris-primary-700"
                        >
                          <Download className="h-3 w-3" />
                          {t('download')}
                        </a>
                      )}
                      {exp.status === 'FAILED' && (
                        <button
                          onClick={() => handleRetry(exp.id)}
                          disabled={retryExport.isPending}
                          className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50"
                        >
                          <RefreshCw className="h-3 w-3" />
                          {t('retry')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {exports.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    {t('noExportsFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total > meta.limit && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Showing {(meta.page - 1) * meta.limit + 1}&ndash;
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * meta.limit >= meta.total}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
