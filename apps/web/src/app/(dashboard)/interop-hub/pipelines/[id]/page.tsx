'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Play, Pause, Zap, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronRight, Settings, AlertCircle, ArrowDownLeft,
  ArrowUpRight, ArrowLeftRight, GitBranch,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import {
  useHubPipeline,
  useHubTransactions,
  useExecuteHubPipeline,
  useActivateHubPipeline,
  usePauseHubPipeline,
  type HubPipelineStep,
  type HubTransaction,
} from '@/lib/api/hub-hooks';

/* ── Constants ────────────────────────────────────────────────── */

const STATUS_CFG: Record<string, { dot: string; bg: string; text: string }> = {
  ACTIVE: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300' },
  PAUSED: { dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300' },
  DRAFT: { dot: 'bg-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/30', text: 'text-gray-600 dark:text-gray-400' },
  ARCHIVED: { dot: 'bg-red-400', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-600 dark:text-red-400' },
};

const TX_DOT: Record<string, string> = {
  COMPLETED: 'bg-emerald-500', FAILED: 'bg-red-500', IN_PROGRESS: 'bg-blue-500',
  PENDING: 'bg-gray-400', AWAITING_APPROVAL: 'bg-purple-500', CANCELLED: 'bg-gray-400',
};

const STEP_ICON: Record<string, React.ElementType> = {
  EXTRACT: ArrowDownLeft, TRANSFORM: Settings, VALIDATE: CheckCircle2,
  MAP: ArrowLeftRight, LOAD: ArrowUpRight, NOTIFY: AlertCircle, CUSTOM: Settings,
};

const STEP_COLOR: Record<string, string> = {
  EXTRACT: 'from-blue-500 to-cyan-500',
  TRANSFORM: 'from-purple-500 to-violet-500',
  VALIDATE: 'from-emerald-500 to-green-500',
  MAP: 'from-amber-500 to-orange-500',
  LOAD: 'from-indigo-500 to-blue-500',
  NOTIFY: 'from-pink-500 to-rose-500',
  CUSTOM: 'from-gray-500 to-gray-600',
};

/* ── Page ─────────────────────────────────────────────────────── */

export default function PipelineDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const t = useTranslations('interopHub');

  const { data: pipeData, isLoading } = useHubPipeline(id);
  const pipe = pipeData?.data;
  const steps = pipe?.steps ?? [];

  const { data: txData } = useHubTransactions({ pipelineId: id, limit: 20 });
  const transactions = txData?.data ?? [];

  const executeMut = useExecuteHubPipeline();
  const activateMut = useActivateHubPipeline();
  const pauseMut = usePauseHubPipeline();

  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-32 animate-pulse rounded-xl bg-card/50 border border-border/50" />
        <div className="h-64 animate-pulse rounded-xl bg-card/50 border border-border/50" />
      </div>
    );
  }

  if (!pipe) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <GitBranch className="h-12 w-12 text-muted-foreground" />
        <p className="mt-3 text-muted-foreground">{t('pipelines.notFound')}</p>
      </div>
    );
  }

  const stCfg = STATUS_CFG[pipe.status] ?? STATUS_CFG.DRAFT;
  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  return (
    <div className="space-y-6 p-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push('/interop-hub/pipelines')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> {t('pipelines.title')}
      </button>

      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-transparent to-transparent" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{pipe.name}</h1>
            {pipe.description && <p className="mt-1 text-sm text-muted-foreground">{pipe.description}</p>}
            <div className="mt-2 flex items-center gap-3">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', stCfg.bg, stCfg.text)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', stCfg.dot)} />
                {pipe.status}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => executeMut.mutate({ id })}
              disabled={executeMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Zap className="h-3.5 w-3.5" /> {t('actions.executeNow')}
            </button>
            {pipe.status !== 'ACTIVE' ? (
              <button type="button" onClick={() => activateMut.mutate(id)} className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/80 px-3 py-2 text-xs font-medium transition-all hover:bg-accent">
                <Play className="h-3.5 w-3.5" /> {t('actions.activate')}
              </button>
            ) : (
              <button type="button" onClick={() => pauseMut.mutate(id)} className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/80 px-3 py-2 text-xs font-medium transition-all hover:bg-accent">
                <Pause className="h-3.5 w-3.5" /> {t('actions.pause')}
              </button>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <InfoBox label={t('col.direction')} value={t(`direction.${pipe.direction}`)} />
          <InfoBox label={t('col.domain')} value={pipe.domain} />
          <InfoBox label={t('col.entity')} value={pipe.entity || '-'} />
          <InfoBox label={t('col.lastRun')} value={pipe.lastExecutedAt ? new Date(pipe.lastExecutedAt).toLocaleString() : '-'} />
        </div>
      </div>

      {/* Pipeline flow visualization - vertical stepper */}
      <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-5">
        <h3 className="mb-5 text-sm font-semibold">{t('pipeline.steps')}</h3>
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <Settings className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">{t('pipeline.noSteps')}</p>
          </div>
        ) : (
          <div className="relative ml-4">
            {/* Vertical connecting line */}
            <div className="absolute left-4 top-5 bottom-5 w-0.5 bg-gradient-to-b from-blue-500/20 via-purple-500/20 to-emerald-500/20" />

            {sorted.map((step, i) => {
              const Icon = STEP_ICON[step.stepType] ?? Settings;
              const expanded = expandedStep === step.id;
              const color = STEP_COLOR[step.stepType] ?? 'from-gray-500 to-gray-600';
              const isActive = step.isActive;
              return (
                <div key={step.id} className="relative pb-6 last:pb-0">
                  <button
                    type="button"
                    onClick={() => setExpandedStep(expanded ? null : step.id)}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200',
                      expanded
                        ? 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20 shadow-md shadow-blue-500/10'
                        : 'border-border/50 hover:border-border hover:bg-accent/30',
                      !isActive && 'opacity-50'
                    )}
                  >
                    {/* Step node */}
                    <div className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-lg',
                      color,
                      expanded && 'ring-2 ring-blue-500/30 ring-offset-2'
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{step.name}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{step.stepType}</span>
                        {!isActive && <span className="text-[10px] text-amber-600">({t('pipeline.disabled')})</span>}
                      </div>
                      {step.description && <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">#{step.stepOrder}</span>
                    {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {/* Expanded config */}
                  {expanded && (
                    <div className="ml-[3.25rem] mt-2 rounded-lg border border-border/50 bg-muted/20 p-4 animate-in slide-in-from-top-2 fade-in duration-200">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <p><span className="font-medium text-muted-foreground">{t('pipeline.onError')}:</span> {(step.config?.onError as string) ?? 'STOP'}</p>
                        <p><span className="font-medium text-muted-foreground">{t('pipeline.timeout')}:</span> {(step.config?.timeoutMs as number) ?? 30000}ms</p>
                      </div>
                      {step.config && Object.keys(step.config).length > 0 && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-medium text-primary">{t('pipeline.showConfig')}</summary>
                          <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs font-mono">
                            {JSON.stringify(step.config, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Execution history as timeline */}
      <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">{t('pipeline.executionHistory')}</h3>
          <Link href={`/interop-hub/transactions?pipelineId=${id}`} className="text-xs text-primary hover:underline">{t('actions.viewAll')}</Link>
        </div>
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center py-8">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">{t('transactions.empty')}</p>
          </div>
        ) : (
          <div className="relative ml-3">
            <div className="absolute left-3 top-2 bottom-2 w-px bg-border/50" />
            {transactions.map((tx) => (
              <div key={tx.id} className="relative flex gap-4 pb-4 last:pb-0">
                <div className="relative z-10 mt-1">
                  <span className={cn('block h-2.5 w-2.5 rounded-full ring-2 ring-background', TX_DOT[tx.status] ?? 'bg-gray-400')} />
                </div>
                <div className="min-w-0 flex-1 rounded-lg border border-border/30 bg-card/30 p-3 transition-all hover:bg-accent/20">
                  <div className="flex items-center gap-2">
                    <Link href={`/interop-hub/transactions/${tx.id}`} className="font-mono text-xs text-primary hover:underline">{tx.id.slice(0, 8)}</Link>
                    <span className="inline-flex items-center gap-1 text-[10px]">
                      <span className={cn('h-1.5 w-1.5 rounded-full', TX_DOT[tx.status])} /> {tx.status}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                    <span>{tx.totalRecords} records</span>
                    {tx.failedRecords > 0 && <span className="text-red-500">{tx.failedRecords} failed</span>}
                    <span className="ml-auto">{new Date(tx.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/30 bg-card/50 p-3">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
