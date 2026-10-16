'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Play, Pause, Zap, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronRight, Settings, AlertCircle,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useHubPipeline,
  useHubTransactions,
  useExecuteHubPipeline,
  useActivateHubPipeline,
  usePauseHubPipeline,
  type HubPipelineStep,
  type HubTransaction,
} from '@/lib/api/hub-hooks';

const STATUS_CLS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  DRAFT: 'bg-gray-100 text-gray-700',
  ARCHIVED: 'bg-red-100 text-red-600',
};

const TX_STATUS_CLS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-gray-100 text-gray-700',
  AWAITING_APPROVAL: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

const STEP_ICON: Record<string, React.ElementType> = {
  EXTRACT: Play,
  TRANSFORM: Settings,
  VALIDATE: CheckCircle2,
  MAP: Settings,
  LOAD: CheckCircle2,
  NOTIFY: AlertCircle,
};

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
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (!pipe) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">{t('pipelines.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => router.push('/interop-hub/pipelines')}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t('pipelines.title')}
        </button>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{pipe.name}</h1>
            <p className="text-sm text-muted-foreground">{pipe.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLS[pipe.status] ?? 'bg-gray-100'}`}>
              {pipe.status}
            </span>
            <button
              type="button"
              onClick={() => executeMut.mutate({ id })}
              disabled={executeMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Zap className="h-3.5 w-3.5" /> {t('actions.executeNow')}
            </button>
            {pipe.status !== 'ACTIVE' ? (
              <button
                type="button"
                onClick={() => activateMut.mutate(id)}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
              >
                <Play className="h-3.5 w-3.5" /> {t('actions.activate')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => pauseMut.mutate(id)}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
              >
                <Pause className="h-3.5 w-3.5" /> {t('actions.pause')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline info */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <InfoBox label={t('col.direction')} value={t(`direction.${pipe.direction}`)} />
        <InfoBox label={t('col.domain')} value={pipe.domain} />
        <InfoBox label={t('col.entity')} value={pipe.entity || '-'} />
        <InfoBox label={t('col.lastRun')} value={pipe.lastExecutedAt ? new Date(pipe.lastExecutedAt).toLocaleString() : '-'} />
      </div>

      {/* Steps visualization */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-sm font-semibold">{t('pipeline.steps')}</h3>
        {steps.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('pipeline.noSteps')}</p>
        ) : (
          <div className="space-y-2">
            {[...steps].sort((a, b) => a.stepOrder - b.stepOrder).map((step, i) => {
              const Icon = STEP_ICON[step.stepType] ?? Settings;
              const expanded = expandedStep === step.id;
              return (
                <div key={step.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedStep(expanded ? null : step.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
                      !step.isActive ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <span className="text-xs font-bold">{step.stepOrder}</span>
                    </div>
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{step.name}</p>
                      <p className="text-xs text-muted-foreground">{step.stepType}{!step.isActive ? ` (${t('pipeline.disabled')})` : ''}</p>
                    </div>
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {expanded && (
                    <div className="ml-14 mt-1 rounded-md border bg-muted/30 p-3">
                      <p className="mb-2 text-xs text-muted-foreground">{step.description || t('pipeline.noDescription')}</p>
                      <p className="text-xs"><span className="font-medium">{t('pipeline.onError')}:</span> {step.config?.onError ?? 'STOP'}</p>
                      <p className="text-xs"><span className="font-medium">{t('pipeline.timeout')}:</span> {(step.config?.timeoutMs as number) ?? 30000}ms</p>
                      {step.config && Object.keys(step.config).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-primary">{t('pipeline.showConfig')}</summary>
                          <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                            {JSON.stringify(step.config, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                  {i < steps.length - 1 && (
                    <div className="ml-[1.9rem] h-4 border-l-2 border-dashed border-muted-foreground/30" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Execution history */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-sm font-semibold">{t('pipeline.executionHistory')}</h3>
          <Link
            href={`/interop-hub/transactions?pipelineId=${id}`}
            className="text-xs text-primary hover:underline"
          >
            {t('actions.viewAll')}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">{t('col.id')}</th>
                <th className="px-4 py-2 font-medium">{t('col.status')}</th>
                <th className="px-4 py-2 font-medium">{t('col.records')}</th>
                <th className="px-4 py-2 font-medium">{t('col.failed')}</th>
                <th className="px-4 py-2 font-medium">{t('col.date')}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t('transactions.empty')}</td></tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-2">
                    <Link href={`/interop-hub/transactions/${tx.id}`} className="font-mono text-xs text-primary hover:underline">
                      {tx.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TX_STATUS_CLS[tx.status] ?? 'bg-gray-100'}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">{tx.totalRecords}</td>
                  <td className="px-4 py-2 text-xs text-red-600">{tx.failedRecords}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
