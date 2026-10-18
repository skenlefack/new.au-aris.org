'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Play, Pause, Trash2, Clock, Timer, X, Calendar,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import {
  useHubSchedules,
  useCreateHubSchedule,
  useDeleteHubSchedule,
  useActivateHubSchedule,
  usePauseHubSchedule,
  type HubScheduleStatus,
} from '@/lib/api/hub-hooks';

/* ── Constants ────────────────────────────────────────────────── */

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-500', PAUSED: 'bg-amber-500', COMPLETED: 'bg-gray-400', ERROR: 'bg-red-500',
};

const FREQ_COLOR: Record<string, string> = {
  ONCE: 'bg-gray-100 dark:bg-gray-800/30 text-gray-700 dark:text-gray-300',
  HOURLY: 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300',
  DAILY: 'bg-cyan-100 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300',
  WEEKLY: 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300',
  MONTHLY: 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300',
  QUARTERLY: 'bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300',
  YEARLY: 'bg-pink-100 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300',
  CRON: 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300',
};

/* ── Page ─────────────────────────────────────────────────────── */

export default function SchedulesPage() {
  const t = useTranslations('interopHub');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useHubSchedules({ page, limit });
  const schedules = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const activateMut = useActivateHubSchedule();
  const pauseMut = usePauseHubSchedule();
  const deleteMut = useDeleteHubSchedule();

  const [showNew, setShowNew] = useState(false);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('schedules.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('schedules.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-amber-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
          >
            <Plus className="h-4 w-4" /> {t('actions.newSchedule')}
          </button>
        </div>
      </div>

      {/* Inline create form */}
      {showNew && <NewScheduleForm t={t} onClose={() => setShowNew(false)} />}

      {/* Schedule cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-card/50 border border-border/50" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">{t('schedules.empty')}</p>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {t('actions.newSchedule')}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {schedules.map((sch) => (
              <ScheduleCard
                key={sch.id}
                sch={sch}
                onActivate={() => activateMut.mutate(sch.id)}
                onPause={() => pauseMut.mutate(sch.id)}
                onDelete={() => { if (confirm(t('actions.confirmDelete'))) deleteMut.mutate(sch.id); }}
                t={t}
              />
            ))}

            {/* "+" card to add */}
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 py-12 text-muted-foreground transition-all hover:border-primary/50 hover:text-primary hover:bg-primary/5"
            >
              <Plus className="h-8 w-8" />
              <span className="mt-2 text-sm font-medium">{t('actions.newSchedule')}</span>
            </button>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 px-5 py-3">
              <p className="text-xs text-muted-foreground">{total} {t('schedules.total')}</p>
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

/* ── Schedule card ────────────────────────────────────────────── */

function ScheduleCard({ sch, onActivate, onPause, onDelete, t }: {
  sch: any; onActivate: () => void; onPause: () => void; onDelete: () => void;
  t: (k: string) => string;
}) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!sch.nextRunAt) return;
    const interval = setInterval(() => {
      const diff = new Date(sch.nextRunAt).getTime() - Date.now();
      if (diff <= 0) { setCountdown('Now'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [sch.nextRunAt]);

  return (
    <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-semibold line-clamp-1">{sch.name}</p>
          {sch.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{sch.description}</p>}
        </div>
        {/* Toggle switch */}
        <button
          type="button"
          onClick={sch.status === 'ACTIVE' ? onPause : onActivate}
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors',
            sch.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
          )}
        >
          <span className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            sch.status === 'ACTIVE' ? 'translate-x-5' : 'translate-x-0.5'
          )} />
        </button>
      </div>

      {/* Pipeline */}
      <p className="mt-2 text-xs text-muted-foreground">
        {sch.pipeline?.name ?? sch.pipelineId?.slice(0, 8) ?? '-'}
      </p>

      {/* Frequency badge */}
      <div className="mt-3 flex items-center gap-2">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold', FREQ_COLOR[sch.frequency] ?? 'bg-gray-100 text-gray-700')}>
          <Calendar className="h-3 w-3" />
          {sch.frequency}
        </span>
        {sch.cronExpression && (
          <span className="font-mono text-[10px] text-muted-foreground">{sch.cronExpression}</span>
        )}
      </div>

      {/* Next run countdown */}
      {sch.nextRunAt && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/30 p-2">
          <Timer className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs font-medium">Next run: <span className="text-primary font-bold">{countdown || '...'}</span></p>
            <p className="text-[10px] text-muted-foreground">{new Date(sch.nextRunAt).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Last run */}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Last: {sch.lastRunAt ? new Date(sch.lastRunAt).toLocaleDateString() : '-'}</span>
        {sch.lastRunStatus && (
          <span className="inline-flex items-center gap-1">
            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[sch.lastRunStatus] ?? 'bg-gray-400')} />
            {sch.lastRunStatus}
          </span>
        )}
      </div>

      {/* Delete button */}
      <div className="mt-3 flex justify-end border-t border-border/30 pt-2">
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive transition-all hover:bg-accent"
        >
          <Trash2 className="h-3 w-3" /> {t('actions.delete')}
        </button>
      </div>
    </div>
  );
}

/* ── New schedule form ────────────────────────────────────────── */

function NewScheduleForm({ t, onClose }: { t: (k: string) => string; onClose: () => void }) {
  const createMut = useCreateHubSchedule();
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('DAILY');
  const [cron, setCron] = useState('');
  const [pipelineId, setPipelineId] = useState('');

  const FREQUENCIES = ['ONCE', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CRON'];

  async function handleCreate() {
    try {
      await createMut.mutateAsync({
        name,
        frequency: frequency as any,
        cronExpression: frequency === 'CRON' ? cron : undefined,
        pipelineId: pipelineId || undefined,
      });
      onClose();
    } catch { /* handled by mutation */ }
  }

  return (
    <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-5 animate-in slide-in-from-top-2 fade-in duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">{t('schedules.new')}</h3>
        <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium">{t('field.name')}</label>
          <input
            className="w-full rounded-lg border border-border/50 bg-background px-3 py-2.5 text-sm transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder={t('placeholder.scheduleName')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium">{t('field.frequency')}</label>
          <select
            className="w-full rounded-lg border border-border/50 bg-background px-3 py-2.5 text-sm transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
            value={frequency} onChange={(e) => setFrequency(e.target.value)}
          >
            {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        {frequency === 'CRON' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium">{t('field.cronExpression')}</label>
            <input
              className="w-full rounded-lg border border-border/50 bg-background px-3 py-2.5 font-mono text-sm transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
              value={cron} onChange={(e) => setCron(e.target.value)}
              placeholder="0 2 * * *"
            />
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-medium">{t('field.pipelineId')}</label>
          <input
            className="w-full rounded-lg border border-border/50 bg-background px-3 py-2.5 text-sm transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
            value={pipelineId} onChange={(e) => setPipelineId(e.target.value)}
            placeholder={t('placeholder.pipelineId')}
          />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={!name || createMut.isPending}
          onClick={handleCreate}
          className="rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-amber-500/25 transition-all hover:-translate-y-0.5 disabled:opacity-40"
        >
          {createMut.isPending ? t('actions.creating') : t('actions.create')}
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border border-border/50 px-5 py-2.5 text-sm font-medium transition-all hover:bg-accent">
          {t('actions.cancel')}
        </button>
      </div>
    </div>
  );
}
