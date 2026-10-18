'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, RefreshCw, XCircle, CheckCircle2, AlertTriangle,
  Clock, ArrowRight, ChevronDown, ChevronRight, ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  Loader2, Activity,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import {
  useHubTransaction,
  useRetryHubTransaction,
  useCancelHubTransaction,
  type HubTransactionStepLog,
  type HubTransactionRecord,
} from '@/lib/api/hub-hooks';

/* ── Constants ────────────────────────────────────────────────── */

const TX_CFG: Record<string, { dot: string; bg: string; text: string; icon: React.ElementType }> = {
  COMPLETED: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
  FAILED: { dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300', icon: XCircle },
  IN_PROGRESS: { dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', icon: Loader2 },
  PENDING: { dot: 'bg-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/30', text: 'text-gray-600 dark:text-gray-400', icon: Clock },
  AWAITING_APPROVAL: { dot: 'bg-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-700 dark:text-purple-300', icon: Clock },
  CANCELLED: { dot: 'bg-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/30', text: 'text-gray-500', icon: XCircle },
};

const STEP_STATUS_CFG: Record<string, { icon: React.ElementType; dot: string; line: string }> = {
  SUCCESS: { icon: CheckCircle2, dot: 'bg-emerald-500 ring-emerald-500/20', line: 'bg-emerald-500' },
  FAILED: { icon: XCircle, dot: 'bg-red-500 ring-red-500/20', line: 'bg-red-500' },
  SKIPPED: { icon: ArrowRight, dot: 'bg-gray-400 ring-gray-400/20', line: 'bg-gray-300' },
};

const RECORD_DOT: Record<string, string> = {
  PROCESSED: 'bg-emerald-500', FAILED: 'bg-red-500', SKIPPED: 'bg-gray-400',
  PENDING: 'bg-blue-500', DUPLICATE: 'bg-amber-500',
};

const DIR_ICON: Record<string, React.ElementType> = {
  INBOUND: ArrowDownLeft, OUTBOUND: ArrowUpRight, BIDIRECTIONAL: ArrowLeftRight,
};

/* ── Page ─────────────────────────────────────────────────────── */

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
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-40 animate-pulse rounded-xl bg-card/50 border border-border/50" />
        <div className="h-64 animate-pulse rounded-xl bg-card/50 border border-border/50" />
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Activity className="h-12 w-12 text-muted-foreground" />
        <p className="mt-3 text-muted-foreground">{t('transactions.notFound')}</p>
      </div>
    );
  }

  const canRetry = ['FAILED', 'CANCELLED'].includes(tx.status);
  const canCancel = ['PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL'].includes(tx.status);
  const stCfg = TX_CFG[tx.status] ?? TX_CFG.PENDING;
  const StatusIcon = stCfg.icon;
  const DirIcon = DIR_ICON[tx.direction] ?? ArrowLeftRight;
  const duration = tx.startedAt && tx.completedAt
    ? Math.round((new Date(tx.completedAt).getTime() - new Date(tx.startedAt).getTime()) / 1000)
    : null;

  return (
    <div className="space-y-6 p-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push('/interop-hub/transactions')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> {t('transactions.title')}
      </button>

      {/* Transaction header card */}
      <div className="relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-transparent to-transparent" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <div className={cn('flex h-14 w-14 items-center justify-center rounded-xl border', stCfg.bg, stCfg.text)}>
              <StatusIcon className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{t('transaction.detail')}</h1>
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold', stCfg.bg, stCfg.text)}>
                  <span className={cn('h-2 w-2 rounded-full', stCfg.dot)} />
                  {tx.status}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{tx.id}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><DirIcon className="h-3.5 w-3.5" /> {t(`direction.${tx.direction}`)}</span>
                {duration !== null && <span>{duration}s</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {canRetry && (
              <button type="button" onClick={() => retryMut.mutate(id)} disabled={retryMut.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:-translate-y-0.5 disabled:opacity-50">
                <RefreshCw className="h-3.5 w-3.5" /> {t('actions.retry')}
              </button>
            )}
            {canCancel && (
              <button type="button" onClick={() => cancelMut.mutate(id)} disabled={cancelMut.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/80 px-3 py-2 text-xs font-medium transition-all hover:bg-accent disabled:opacity-50">
                <XCircle className="h-3.5 w-3.5" /> {t('actions.cancel')}
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <InfoBox label={t('col.domain')} value={tx.domain} />
          <InfoBox label={t('col.connection')} value={tx.connection?.name ?? '-'} />
          <InfoBox label={t('col.records')} value={`${tx.processedRecords}/${tx.totalRecords}`} />
          <InfoBox label={t('col.failed')} value={String(tx.failedRecords)} highlight={tx.failedRecords > 0} />
          <InfoBox label={t('detail.pipeline')} value={tx.pipeline?.name ?? '-'} />
        </div>
      </div>

      {/* Error message */}
      {tx.errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{t('detail.errorMessage')}</p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-400">{tx.errorMessage}</p>
          </div>
        </div>
      )}

      {/* Step timeline */}
      {tx.stepLogs && tx.stepLogs.length > 0 && (
        <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-5">
          <h3 className="mb-5 text-sm font-semibold">{t('transaction.stepLog')}</h3>
          <div className="relative ml-4">
            {tx.stepLogs.map((sl, i) => {
              const cfg = STEP_STATUS_CFG[sl.status] ?? STEP_STATUS_CFG.SKIPPED;
              const Icon = cfg.icon;
              const isExp = expandedStep === sl.id;
              return (
                <div key={sl.id} className="relative pb-6 last:pb-0">
                  {/* Connector line */}
                  {i < tx.stepLogs!.length - 1 && (
                    <div className={cn('absolute left-[0.5625rem] top-7 bottom-0 w-0.5', cfg.line)} />
                  )}
                  <div className="flex gap-4">
                    {/* Node */}
                    <div className={cn('relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-4 ring-background', cfg.dot)}>
                      <Icon className="h-3 w-3 text-white" />
                    </div>
                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setExpandedStep(isExp ? null : sl.id)}
                        className="flex w-full items-center justify-between text-left"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{sl.stepName}</p>
                            <span className={cn('text-[10px] font-medium', sl.status === 'SUCCESS' ? 'text-emerald-600' : sl.status === 'FAILED' ? 'text-red-600' : 'text-gray-500')}>{sl.status}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {sl.durationMs}ms
                            {sl.startedAt && ` | ${new Date(sl.startedAt).toLocaleTimeString()}`}
                          </p>
                          {sl.errorMessage && <p className="mt-1 text-xs text-red-500">{sl.errorMessage}</p>}
                        </div>
                        {(sl.inputSummary || sl.outputSummary) && (
                          <span>{isExp ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</span>
                        )}
                      </button>
                      {isExp && (sl.inputSummary || sl.outputSummary) && (
                        <div className="mt-2 space-y-2 animate-in slide-in-from-top-1 fade-in duration-200">
                          {sl.inputSummary && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">Input</p>
                              <pre className="max-h-32 overflow-auto rounded-lg bg-muted/50 border border-border/30 p-2 text-xs font-mono">{JSON.stringify(sl.inputSummary, null, 2)}</pre>
                            </div>
                          )}
                          {sl.outputSummary && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">Output</p>
                              <pre className="max-h-32 overflow-auto rounded-lg bg-muted/50 border border-border/30 p-2 text-xs font-mono">{JSON.stringify(sl.outputSummary, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Records grid */}
      {tx.records && tx.records.length > 0 && (
        <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-5">
          <h3 className="mb-4 text-sm font-semibold">{t('transaction.records')}</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tx.records.map((rec) => {
              const isExp = expandedRecord === rec.id;
              return (
                <div
                  key={rec.id}
                  className={cn(
                    'rounded-lg border transition-all duration-200',
                    isExp ? 'border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/10' : 'border-border/50 hover:border-border'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedRecord(isExp ? null : rec.id)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', RECORD_DOT[rec.status] ?? 'bg-gray-400')} />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-medium">{rec.externalId ?? rec.id.slice(0, 8)}</p>
                      <p className="text-[10px] text-muted-foreground">{rec.entityType} / {rec.status}</p>
                    </div>
                    {rec.errorMessage && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                    {isExp ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  {isExp && (
                    <div className="border-t border-border/30 p-3 space-y-2 animate-in slide-in-from-top-1 fade-in duration-200">
                      {rec.errorMessage && <p className="text-xs text-red-500">{rec.errorMessage}</p>}
                      {rec.sourceData && (
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">{t('transaction.sourceData')}</p>
                          <pre className="max-h-32 overflow-auto rounded bg-muted/50 p-2 text-[10px] font-mono">{JSON.stringify(rec.sourceData, null, 2)}</pre>
                        </div>
                      )}
                      {rec.mappedData && (
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">{t('transaction.mappedData')}</p>
                          <pre className="max-h-32 overflow-auto rounded bg-muted/50 p-2 text-[10px] font-mono">{JSON.stringify(rec.mappedData, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */

function InfoBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border/30 bg-card/50 p-3">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('mt-1 text-sm font-semibold', highlight && 'text-red-600')}>{value}</p>
    </div>
  );
}
