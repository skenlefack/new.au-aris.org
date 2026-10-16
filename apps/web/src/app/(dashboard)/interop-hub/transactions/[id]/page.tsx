'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, RefreshCw, XCircle, CheckCircle2, AlertTriangle,
  Clock, ArrowRight, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useHubTransaction,
  useRetryHubTransaction,
  useCancelHubTransaction,
  type HubTransactionStepLog,
  type HubTransactionRecord,
} from '@/lib/api/hub-hooks';

const TX_STATUS_CLS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-gray-100 text-gray-700',
  AWAITING_APPROVAL: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

const STEP_STATUS_ICON: Record<string, { icon: React.ElementType; cls: string }> = {
  SUCCESS: { icon: CheckCircle2, cls: 'text-green-500' },
  FAILED: { icon: XCircle, cls: 'text-red-500' },
  SKIPPED: { icon: ArrowRight, cls: 'text-gray-400' },
};

const RECORD_STATUS_CLS: Record<string, string> = {
  PROCESSED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  SKIPPED: 'bg-gray-100 text-gray-600',
  PENDING: 'bg-blue-100 text-blue-700',
  DUPLICATE: 'bg-yellow-100 text-yellow-700',
};

export default function TransactionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const t = useTranslations('interopHub');

  const { data: txData, isLoading } = useHubTransaction(id);
  const tx = txData?.data;

  const retryMut = useRetryHubTransaction();
  const cancelMut = useCancelHubTransaction();

  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">{t('transactions.notFound')}</p>
      </div>
    );
  }

  const canRetry = ['FAILED', 'CANCELLED'].includes(tx.status);
  const canCancel = ['PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL'].includes(tx.status);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => router.push('/interop-hub/transactions')}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t('transactions.title')}
        </button>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{t('transaction.detail')}</h1>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${TX_STATUS_CLS[tx.status] ?? 'bg-gray-100'}`}>
                {tx.status}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{tx.id}</p>
          </div>
          <div className="flex gap-2">
            {canRetry && (
              <button
                type="button"
                onClick={() => retryMut.mutate(id)}
                disabled={retryMut.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> {t('actions.retry')}
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={() => cancelMut.mutate(id)}
                disabled={cancelMut.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
              >
                <XCircle className="h-3.5 w-3.5" /> {t('actions.cancel')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transaction info */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <InfoBox label={t('col.direction')} value={t(`direction.${tx.direction}`)} />
        <InfoBox label={t('col.domain')} value={tx.domain} />
        <InfoBox label={t('col.connection')} value={tx.connection?.name ?? '-'} />
        <InfoBox label={t('col.records')} value={`${tx.processedRecords}/${tx.totalRecords}`} />
        <InfoBox label={t('col.failed')} value={String(tx.failedRecords)} highlight={tx.failedRecords > 0} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <InfoBox label={t('detail.started')} value={tx.startedAt ? new Date(tx.startedAt).toLocaleString() : '-'} />
        <InfoBox label={t('detail.completed')} value={tx.completedAt ? new Date(tx.completedAt).toLocaleString() : '-'} />
        <InfoBox label={t('detail.pipeline')} value={tx.pipeline?.name ?? '-'} />
        <InfoBox label={t('detail.entity')} value={tx.entity || '-'} />
      </div>

      {tx.errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">{t('detail.errorMessage')}</p>
              <p className="mt-1 text-sm text-red-700">{tx.errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Step log timeline */}
      {tx.stepLogs && tx.stepLogs.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-4 text-sm font-semibold">{t('transaction.stepLog')}</h3>
          <div className="space-y-0">
            {tx.stepLogs.map((sl, i) => {
              const cfg = STEP_STATUS_ICON[sl.status] ?? { icon: Clock, cls: 'text-gray-400' };
              const Icon = cfg.icon;
              return (
                <div key={sl.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${cfg.cls} bg-white`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    {i < tx.stepLogs!.length - 1 && <div className="h-8 w-px bg-border" />}
                  </div>
                  <div className="pb-6">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-medium">{sl.stepName}</p>
                      <span className={`text-xs ${cfg.cls}`}>{sl.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {sl.durationMs}ms
                      {sl.startedAt && ` | ${new Date(sl.startedAt).toLocaleTimeString()}`}
                    </p>
                    {sl.errorMessage && (
                      <p className="mt-1 text-xs text-red-600">{sl.errorMessage}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Records table */}
      {tx.records && tx.records.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h3 className="text-sm font-semibold">{t('transaction.records')}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-8 px-4 py-2" />
                  <th className="px-4 py-2 font-medium">{t('col.externalId')}</th>
                  <th className="px-4 py-2 font-medium">{t('col.entity')}</th>
                  <th className="px-4 py-2 font-medium">{t('col.status')}</th>
                  <th className="px-4 py-2 font-medium">{t('col.error')}</th>
                </tr>
              </thead>
              <tbody>
                {tx.records.map((rec) => {
                  const isExpanded = expandedRecord === rec.id;
                  return (
                    <React.Fragment key={rec.id}>
                      <tr className="border-b hover:bg-muted/50">
                        <td className="px-4 py-2">
                          <button type="button" onClick={() => setExpandedRecord(isExpanded ? null : rec.id)} className="rounded p-1 hover:bg-muted">
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{rec.externalId ?? '-'}</td>
                        <td className="px-4 py-2 text-xs">{rec.entityType}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${RECORD_STATUS_CLS[rec.status] ?? 'bg-gray-100'}`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="max-w-[300px] truncate px-4 py-2 text-xs text-red-600">
                          {rec.errorMessage ?? '-'}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b bg-muted/20">
                          <td colSpan={5} className="px-8 py-3">
                            {rec.sourceData && (
                              <div className="mb-2">
                                <p className="mb-1 text-xs font-medium">{t('transaction.sourceData')}:</p>
                                <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                                  {JSON.stringify(rec.sourceData, null, 2)}
                                </pre>
                              </div>
                            )}
                            {rec.mappedData && (
                              <div>
                                <p className="mb-1 text-xs font-medium">{t('transaction.mappedData')}:</p>
                                <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                                  {JSON.stringify(rec.mappedData, null, 2)}
                                </pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-medium ${highlight ? 'text-red-600' : ''}`}>{value}</p>
    </div>
  );
}
