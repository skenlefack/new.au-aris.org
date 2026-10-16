'use client';

import { useState } from 'react';
import { Plus, MoreHorizontal, Play, Pause, Trash2, Clock } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useHubSchedules,
  useCreateHubSchedule,
  useDeleteHubSchedule,
  useActivateHubSchedule,
  usePauseHubSchedule,
  type HubScheduleStatus,
} from '@/lib/api/hub-hooks';

const STATUS_CLS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-gray-100 text-gray-700',
  ERROR: 'bg-red-100 text-red-700',
};

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

  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('schedules.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('schedules.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> {t('actions.newSchedule')}
        </button>
      </div>

      {showNew && <NewScheduleForm t={t} onClose={() => setShowNew(false)} />}

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t('col.name')}</th>
                <th className="px-4 py-3 font-medium">{t('col.pipeline')}</th>
                <th className="px-4 py-3 font-medium">{t('col.frequency')}</th>
                <th className="px-4 py-3 font-medium">{t('col.nextRun')}</th>
                <th className="px-4 py-3 font-medium">{t('col.lastRun')}</th>
                <th className="px-4 py-3 font-medium">{t('col.status')}</th>
                <th className="px-4 py-3 font-medium">{t('col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={7} className="px-4 py-4"><div className="h-5 animate-pulse rounded bg-muted" /></td>
                  </tr>
                ))
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('schedules.empty')}</p>
                  </td>
                </tr>
              ) : (
                schedules.map((sch) => (
                  <tr key={sch.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{sch.name}</p>
                      {sch.description && <p className="text-xs text-muted-foreground">{sch.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs">{sch.pipeline?.name ?? sch.pipelineId?.slice(0, 8) ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded bg-muted px-2 py-0.5 text-xs font-medium">
                        {sch.frequency}
                      </span>
                      {sch.cronExpression && (
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{sch.cronExpression}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {sch.nextRunAt ? new Date(sch.nextRunAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">
                        {sch.lastRunAt ? new Date(sch.lastRunAt).toLocaleString() : '-'}
                      </span>
                      {sch.lastRunStatus && (
                        <span className={`ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_CLS[sch.lastRunStatus] ?? 'bg-gray-100'}`}>
                          {sch.lastRunStatus}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[sch.status] ?? 'bg-gray-100'}`}>
                        {sch.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMenuOpen(menuOpen === sch.id ? null : sch.id)}
                          className="rounded-md p-1 hover:bg-muted"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuOpen === sch.id && (
                          <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border bg-popover py-1 shadow-md">
                            {sch.status !== 'ACTIVE' && (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                                onClick={() => { activateMut.mutate(sch.id); setMenuOpen(null); }}
                              >
                                <Play className="h-3.5 w-3.5" /> {t('actions.activate')}
                              </button>
                            )}
                            {sch.status === 'ACTIVE' && (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                                onClick={() => { pauseMut.mutate(sch.id); setMenuOpen(null); }}
                              >
                                <Pause className="h-3.5 w-3.5" /> {t('actions.pause')}
                              </button>
                            )}
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
                              onClick={() => { if (confirm(t('actions.confirmDelete'))) deleteMut.mutate(sch.id); setMenuOpen(null); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> {t('actions.delete')}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">{total} {t('schedules.total')}</p>
            <div className="flex gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-50">{t('pagination.prev')}</button>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-50">{t('pagination.next')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline new schedule form ──────────────────────────────────────────────────

function NewScheduleForm({
  t,
  onClose,
}: {
  t: (k: string) => string;
  onClose: () => void;
}) {
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
    } catch {
      // handled by mutation
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-4 text-sm font-semibold">{t('schedules.new')}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium">{t('field.name')}</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('placeholder.scheduleName')}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t('field.frequency')}</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
          >
            {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        {frequency === 'CRON' && (
          <div>
            <label className="mb-1 block text-xs font-medium">{t('field.cronExpression')}</label>
            <input
              className="w-full rounded-md border px-3 py-2 font-mono text-sm"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              placeholder="0 2 * * *"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium">{t('field.pipelineId')}</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            placeholder={t('placeholder.pipelineId')}
          />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={!name || createMut.isPending}
          onClick={handleCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {createMut.isPending ? t('actions.creating') : t('actions.create')}
        </button>
        <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
          {t('actions.cancel')}
        </button>
      </div>
    </div>
  );
}
