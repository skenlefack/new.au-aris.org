'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Play, Pause, Trash2, Pencil, Zap } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useHubPipelines,
  useDeleteHubPipeline,
  useActivateHubPipeline,
  usePauseHubPipeline,
  useExecuteHubPipeline,
  type HubPipelineStatus,
  type HubDirection,
} from '@/lib/api/hub-hooks';

const STATUS_CLS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  DRAFT: 'bg-gray-100 text-gray-700',
  ARCHIVED: 'bg-red-100 text-red-600',
};

const MODE_CLS: Record<string, string> = {
  AUTO: 'bg-blue-100 text-blue-700',
  MANUAL: 'bg-purple-100 text-purple-700',
};

const STATUSES: HubPipelineStatus[] = ['ACTIVE', 'PAUSED', 'DRAFT', 'ARCHIVED'];
const DIRECTIONS: HubDirection[] = ['INBOUND', 'OUTBOUND', 'BIDIRECTIONAL'];

export default function PipelinesListPage() {
  const t = useTranslations('interopHub');
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useHubPipelines({
    direction: (direction as HubDirection) || undefined,
    status: (status as HubPipelineStatus) || undefined,
    page,
    limit,
  });

  const pipelines = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const deleteMut = useDeleteHubPipeline();
  const activateMut = useActivateHubPipeline();
  const pauseMut = usePauseHubPipeline();
  const executeMut = useExecuteHubPipeline();

  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pipelines.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('pipelines.subtitle')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label={t('filter.direction')}
          value={direction}
          onChange={(v) => { setDirection(v); setPage(1); }}
          options={DIRECTIONS.map((d) => ({ value: d, label: t(`direction.${d}`) }))}
          allLabel={t('filter.all')}
        />
        <FilterSelect
          label={t('filter.status')}
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={STATUSES.map((s) => ({ value: s, label: s }))}
          allLabel={t('filter.all')}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t('col.name')}</th>
                <th className="px-4 py-3 font-medium">{t('col.connection')}</th>
                <th className="px-4 py-3 font-medium">{t('col.direction')}</th>
                <th className="px-4 py-3 font-medium">{t('col.domain')}</th>
                <th className="px-4 py-3 font-medium">{t('col.status')}</th>
                <th className="px-4 py-3 font-medium">{t('col.lastRun')}</th>
                <th className="px-4 py-3 font-medium">{t('col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-5 animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))
              ) : pipelines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    {t('pipelines.empty')}
                  </td>
                </tr>
              ) : (
                pipelines.map((pipe) => (
                  <tr key={pipe.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link href={`/interop-hub/pipelines/${pipe.id}`} className="font-medium text-primary hover:underline">
                        {pipe.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {pipe.connection ? (
                        <Link href={`/interop-hub/connections/${pipe.connectionId}`} className="text-primary hover:underline">
                          {pipe.connection.name}
                        </Link>
                      ) : pipe.connectionId?.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-xs">{t(`direction.${pipe.direction}`)}</td>
                    <td className="px-4 py-3 text-xs">{pipe.domain}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[pipe.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {pipe.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {pipe.lastExecutedAt ? new Date(pipe.lastExecutedAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMenuOpen(menuOpen === pipe.id ? null : pipe.id)}
                          className="rounded-md p-1 hover:bg-muted"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuOpen === pipe.id && (
                          <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border bg-popover py-1 shadow-md">
                            <Link
                              href={`/interop-hub/pipelines/${pipe.id}`}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                              onClick={() => setMenuOpen(null)}
                            >
                              <Pencil className="h-3.5 w-3.5" /> {t('actions.edit')}
                            </Link>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                              onClick={() => { executeMut.mutate({ id: pipe.id }); setMenuOpen(null); }}
                            >
                              <Zap className="h-3.5 w-3.5" /> {t('actions.executeNow')}
                            </button>
                            {pipe.status !== 'ACTIVE' && (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                                onClick={() => { activateMut.mutate(pipe.id); setMenuOpen(null); }}
                              >
                                <Play className="h-3.5 w-3.5" /> {t('actions.activate')}
                              </button>
                            )}
                            {pipe.status === 'ACTIVE' && (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                                onClick={() => { pauseMut.mutate(pipe.id); setMenuOpen(null); }}
                              >
                                <Pause className="h-3.5 w-3.5" /> {t('actions.pause')}
                              </button>
                            )}
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
                              onClick={() => { if (confirm(t('actions.confirmDelete'))) deleteMut.mutate(pipe.id); setMenuOpen(null); }}
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
            <p className="text-xs text-muted-foreground">
              {t('pagination.showing', { from: String((page - 1) * limit + 1), to: String(Math.min(page * limit, total)), total: String(total) })}
            </p>
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

function FilterSelect({ label, value, onChange, options, allLabel }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; allLabel: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
