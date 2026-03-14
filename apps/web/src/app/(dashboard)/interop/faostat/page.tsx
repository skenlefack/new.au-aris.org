'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Filter, RefreshCw, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFaostatSyncs, useTriggerFaostatSync } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  pending: { icon: <Clock className="h-3.5 w-3.5" />, color: 'bg-gray-100 text-gray-600' },
  running: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'bg-blue-100 text-blue-700' },
  completed: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'bg-green-100 text-green-700' },
  failed: { icon: <XCircle className="h-3.5 w-3.5" />, color: 'bg-red-100 text-red-700' },
};

export default function FaostatSyncPage() {
  const t = useTranslations('interop');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useFaostatSyncs({
    page,
    limit: 20,
    status: statusFilter || undefined,
  });
  const syncs = data?.data ?? [];
  const meta = data?.meta;

  const triggerSync = useTriggerFaostatSync();
  const [syncDataset, setSyncDataset] = useState('denominators');

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
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('faostatSync')}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {t('faostatSyncDesc')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={syncDataset}
              onChange={(e) => setSyncDataset(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
            >
              <option value="denominators">{t('datasetDenominators')}</option>
              <option value="production">{t('datasetProduction')}</option>
              <option value="trade">{t('datasetTrade')}</option>
              <option value="emissions">{t('datasetEmissions')}</option>
            </select>
            <button
              onClick={() => triggerSync.mutate({ dataset: syncDataset })}
              disabled={triggerSync.isPending}
              className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
            >
              {triggerSync.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t('syncNow')}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
        >
          <option value="">{t('allStatuses')}</option>
          <option value="pending">{t('statusPending')}</option>
          <option value="running">{t('statusRunning')}</option>
          <option value="completed">{t('statusCompleted')}</option>
          <option value="failed">{t('statusFailed')}</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={10} cols={7} />
      ) : (
        <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3">{t('dataset')}</th>
                <th className="px-4 py-3">{t('direction')}</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Records</th>
                <th className="px-4 py-3 text-right">{t('discrepancies')}</th>
                <th className="px-4 py-3">{t('triggeredBy')}</th>
                <th className="px-4 py-3">{t('started')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {syncs.map((s) => {
                const config = STATUS_CONFIG[s.status] ?? STATUS_CONFIG['pending'];
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 capitalize">
                      {s.dataset}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                        s.direction === 'import' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700',
                      )}>
                        {s.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                        config.color,
                      )}>
                        {config.icon}
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {s.recordCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.discrepancies > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          {s.discrepancies}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {s.triggeredBy}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(s.startedAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {syncs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    {t('noFaostatHistory')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.total > meta.limit && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Showing {(meta.page - 1) * meta.limit + 1}–
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * meta.limit >= meta.total} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
