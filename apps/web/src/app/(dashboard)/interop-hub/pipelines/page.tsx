'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  GitBranch, Play, Pause, Trash2, Zap, ArrowRight, Settings,
  CheckCircle2, AlertCircle, ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import {
  useHubPipelines,
  useDeleteHubPipeline,
  useActivateHubPipeline,
  usePauseHubPipeline,
  useExecuteHubPipeline,
  type HubPipelineStatus,
  type HubDirection,
  type HubPipelineStep,
} from '@/lib/api/hub-hooks';

/* ── Constants ────────────────────────────────────────────────── */

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-500', PAUSED: 'bg-amber-500', DRAFT: 'bg-gray-400', ARCHIVED: 'bg-red-400',
};

const MODE_GLOW: Record<string, string> = {
  AUTO: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20',
  MANUAL: 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20',
};

const STEP_ICON: Record<string, React.ElementType> = {
  EXTRACT: ArrowDownLeft, TRANSFORM: Settings, VALIDATE: CheckCircle2,
  MAP: ArrowLeftRight, LOAD: ArrowUpRight, NOTIFY: AlertCircle,
};

const STATUSES: HubPipelineStatus[] = ['ACTIVE', 'PAUSED', 'DRAFT', 'ARCHIVED'];
const DIRECTIONS: HubDirection[] = ['INBOUND', 'OUTBOUND', 'BIDIRECTIONAL'];

/* ── Page ─────────────────────────────────────────────────────── */

export default function PipelinesListPage() {
  const t = useTranslations('interopHub');
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useHubPipelines({
    direction: (direction as HubDirection) || undefined,
    status: (status as HubPipelineStatus) || undefined,
    page, limit,
  });

  const pipelines = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const deleteMut = useDeleteHubPipeline();
  const activateMut = useActivateHubPipeline();
  const pauseMut = usePauseHubPipeline();
  const executeMut = useExecuteHubPipeline();

  const [confirmExec, setConfirmExec] = useState<string | null>(null);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('pipelines.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('pipelines.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground mr-1">{t('filter.direction')}:</span>
        <FilterPill label={t('filter.all')} active={!direction} onClick={() => { setDirection(''); setPage(1); }} />
        {DIRECTIONS.map((d) => (
          <FilterPill key={d} label={t(`direction.${d}`)} active={direction === d} onClick={() => { setDirection(d); setPage(1); }} />
        ))}

        <div className="mx-2 h-5 w-px bg-border" />

        <span className="text-xs font-medium text-muted-foreground mr-1">{t('filter.status')}:</span>
        <FilterPill label={t('filter.all')} active={!status} onClick={() => { setStatus(''); setPage(1); }} />
        {STATUSES.map((s) => (
          <FilterPill key={s} label={s} active={status === s} onClick={() => { setStatus(s); setPage(1); }} dot={STATUS_DOT[s]} />
        ))}
      </div>

      {/* Pipeline cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-card/50 border border-border/50" />
          ))}
        </div>
      ) : pipelines.length === 0 ? (
        <EmptyState icon={GitBranch} message={t('pipelines.empty')} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pipelines.map((pipe) => {
              const steps = pipe.steps ?? [];
              const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
              const mode = (pipe.config as any)?.mode === 'AUTO' ? 'AUTO' : 'MANUAL';
              return (
                <div
                  key={pipe.id}
                  className="group relative rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Header row */}
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/interop-hub/pipelines/${pipe.id}`}
                        className="font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        {pipe.name}
                      </Link>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{pipe.domain}</span>
                        <span>/</span>
                        <span>{t(`direction.${pipe.direction}`)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold', MODE_GLOW[mode])}>
                        {mode}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[pipe.status] ?? 'bg-gray-400')} />
                        {pipe.status}
                      </span>
                    </div>
                  </div>

                  {/* Visual step flow */}
                  {sorted.length > 0 && (
                    <div className="mt-4 flex items-center gap-1 overflow-x-auto">
                      {sorted.map((step, i) => {
                        const Icon = STEP_ICON[step.stepType] ?? Settings;
                        return (
                          <div key={step.id} className="flex items-center gap-1">
                            <div className="flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1" title={step.name}>
                              <Icon className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px] font-medium whitespace-nowrap">{step.name.slice(0, 12)}</span>
                            </div>
                            {i < sorted.length - 1 && (
                              <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {pipe.connection?.name
                        ? <Link href={`/interop-hub/connections/${pipe.connectionId}`} className="text-primary hover:underline">{pipe.connection.name}</Link>
                        : pipe.connectionId?.slice(0, 8)}
                    </span>
                    <span>{pipe.lastExecutedAt ? new Date(pipe.lastExecutedAt).toLocaleDateString() : '-'}</span>
                  </div>

                  {/* Quick actions */}
                  <div className="mt-3 flex gap-1.5 border-t border-border/30 pt-3">
                    <QuickBtn
                      icon={Zap}
                      label={t('actions.executeNow')}
                      onClick={() => setConfirmExec(pipe.id)}
                      className="text-primary"
                    />
                    {pipe.status !== 'ACTIVE' ? (
                      <QuickBtn icon={Play} label={t('actions.activate')} onClick={() => activateMut.mutate(pipe.id)} className="text-emerald-600" />
                    ) : (
                      <QuickBtn icon={Pause} label={t('actions.pause')} onClick={() => pauseMut.mutate(pipe.id)} className="text-amber-600" />
                    )}
                    <QuickBtn
                      icon={Trash2}
                      label={t('actions.delete')}
                      onClick={() => { if (confirm(t('actions.confirmDelete'))) deleteMut.mutate(pipe.id); }}
                      className="text-destructive ml-auto"
                    />
                  </div>

                  {/* Confirm execute dialog */}
                  {confirmExec === pipe.id && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm">
                      <div className="rounded-lg border bg-card p-4 shadow-xl">
                        <p className="text-sm font-medium">{t('actions.confirmExecute') || 'Execute this pipeline?'}</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => { executeMut.mutate({ id: pipe.id }); setConfirmExec(null); }}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                          >
                            {t('actions.confirm') || 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmExec(null)}
                            className="rounded-lg border px-3 py-1.5 text-xs"
                          >
                            {t('actions.cancel')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {t('pagination.showing', { from: String((page - 1) * limit + 1), to: String(Math.min(page * limit, total)), total: String(total) })}
              </p>
              <div className="flex gap-1">
                <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-xs font-medium transition-all hover:bg-accent disabled:opacity-40">{t('pagination.prev')}</button>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-xs font-medium transition-all hover:bg-accent disabled:opacity-40">{t('pagination.next')}</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────── */

function FilterPill({ label, active, onClick, dot }: {
  label: string; active: boolean; onClick: () => void; dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-card/50 border border-border/50 text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
      {label}
    </button>
  );
}

function QuickBtn({ icon: Icon, label, onClick, className }: {
  icon: React.ElementType; label: string; onClick: () => void; className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-all hover:bg-accent', className)}
    >
      <Icon className="h-3 w-3" /> <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 py-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}
