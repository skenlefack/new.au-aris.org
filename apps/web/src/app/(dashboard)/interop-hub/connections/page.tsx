'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, MoreHorizontal, Zap, Pause, Trash2, Pencil, Play, TestTube } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useHubConnections,
  useDeleteHubConnection,
  useActivateHubConnection,
  useSuspendHubConnection,
  useTestHubConnection,
  type HubConnectionStatus,
  type HubDirection,
} from '@/lib/api/hub-hooks';

const STATUS_CLS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-700',
  SUSPENDED: 'bg-orange-100 text-orange-700',
  ERROR: 'bg-red-100 text-red-700',
  DRAFT: 'bg-gray-100 text-gray-600',
  TESTING: 'bg-blue-100 text-blue-700',
  ARCHIVED: 'bg-red-100 text-red-600',
};

const STATUSES: HubConnectionStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ERROR'];
const DIRECTIONS: HubDirection[] = ['INBOUND', 'OUTBOUND', 'BIDIRECTIONAL'];
const SYSTEM_TYPES = ['WAHIS', 'DHIS2', 'FHIR', 'EMPRES', 'FAOSTAT', 'FISHSTATJ', 'CITES', 'CUSTOM_API', 'FILE_EXCHANGE', 'OTHER'];

export default function ConnectionsListPage() {
  const t = useTranslations('interopHub');
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const [systemType, setSystemType] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useHubConnections({
    direction: direction || undefined,
    status: (status as HubConnectionStatus) || undefined,
    externalSystem: systemType || undefined,
    page,
    limit,
  });

  const connections = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const deleteMut = useDeleteHubConnection();
  const activateMut = useActivateHubConnection();
  const suspendMut = useSuspendHubConnection();
  const testMut = useTestHubConnection();

  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('connections.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('connections.subtitle')}</p>
        </div>
        <Link
          href="/interop-hub/connections/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> {t('actions.newConnection')}
        </Link>
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
        <FilterSelect
          label={t('filter.systemType')}
          value={systemType}
          onChange={(v) => { setSystemType(v); setPage(1); }}
          options={SYSTEM_TYPES.map((s) => ({ value: s, label: s }))}
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
                <th className="px-4 py-3 font-medium">{t('col.direction')}</th>
                <th className="px-4 py-3 font-medium">{t('col.systemType')}</th>
                <th className="px-4 py-3 font-medium">{t('col.status')}</th>
                <th className="px-4 py-3 font-medium">{t('col.lastActivity')}</th>
                <th className="px-4 py-3 font-medium">{t('col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="h-5 animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))
              ) : connections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                    {t('connections.empty')}
                  </td>
                </tr>
              ) : (
                connections.map((conn) => (
                  <tr key={conn.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link href={`/interop-hub/connections/${conn.id}`} className="font-medium text-primary hover:underline">
                        {conn.name}
                      </Link>
                      {conn.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground" style={{ maxWidth: 280 }}>
                          {conn.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{t(`direction.${conn.direction}`)}</td>
                    <td className="px-4 py-3 text-xs">{conn.externalSystem ?? conn.transportType}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[conn.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {conn.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {conn.updatedAt ? new Date(conn.updatedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMenuOpen(menuOpen === conn.id ? null : conn.id)}
                          className="rounded-md p-1 hover:bg-muted"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuOpen === conn.id && (
                          <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border bg-popover py-1 shadow-md">
                            <Link
                              href={`/interop-hub/connections/${conn.id}`}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                              onClick={() => setMenuOpen(null)}
                            >
                              <Pencil className="h-3.5 w-3.5" /> {t('actions.edit')}
                            </Link>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                              onClick={() => { testMut.mutate(conn.id); setMenuOpen(null); }}
                            >
                              <TestTube className="h-3.5 w-3.5" /> {t('actions.test')}
                            </button>
                            {conn.status !== 'ACTIVE' && (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                                onClick={() => { activateMut.mutate(conn.id); setMenuOpen(null); }}
                              >
                                <Play className="h-3.5 w-3.5" /> {t('actions.activate')}
                              </button>
                            )}
                            {conn.status === 'ACTIVE' && (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                                onClick={() => { suspendMut.mutate(conn.id); setMenuOpen(null); }}
                              >
                                <Pause className="h-3.5 w-3.5" /> {t('actions.suspend')}
                              </button>
                            )}
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
                              onClick={() => { if (confirm(t('actions.confirmDelete'))) { deleteMut.mutate(conn.id); } setMenuOpen(null); }}
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

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {t('pagination.showing', { from: String((page - 1) * limit + 1), to: String(Math.min(page * limit, total)), total: String(total) })}
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded border px-3 py-1 text-xs disabled:opacity-50"
              >
                {t('pagination.prev')}
              </button>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage(page + 1)}
                className="rounded border px-3 py-1 text-xs disabled:opacity-50"
              >
                {t('pagination.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reusable filter dropdown ──────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
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
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
