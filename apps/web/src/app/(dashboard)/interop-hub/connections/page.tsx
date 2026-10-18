'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus, Pencil, Trash2, Play, Pause, TestTube, Zap,
  Link2, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Wifi, WifiOff, AlertTriangle,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import {
  useHubConnections,
  useDeleteHubConnection,
  useActivateHubConnection,
  useSuspendHubConnection,
  useTestHubConnection,
  type HubConnectionStatus,
  type HubDirection,
} from '@/lib/api/hub-hooks';

/* ── Constants ────────────────────────────────────────────────── */

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  INACTIVE: 'bg-gray-400',
  SUSPENDED: 'bg-amber-500',
  ERROR: 'bg-red-500',
};

const DIRECTION_ICON: Record<string, React.ElementType> = {
  INBOUND: ArrowDownLeft,
  OUTBOUND: ArrowUpRight,
  BIDIRECTIONAL: ArrowLeftRight,
};

const STATUSES: HubConnectionStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ERROR'];
const DIRECTIONS: HubDirection[] = ['INBOUND', 'OUTBOUND', 'BIDIRECTIONAL'];
const SYSTEM_TYPES = ['WAHIS', 'DHIS2', 'FHIR', 'EMPRES', 'FAOSTAT', 'FISHSTATJ', 'CITES', 'CUSTOM_API', 'FILE_EXCHANGE', 'OTHER'];

const SYSTEM_EMOJI: Record<string, string> = {
  WAHIS: '\u{1F30D}', DHIS2: '\u{1F4CA}', FHIR: '\u{2695}', EMPRES: '\u{1F6A8}',
  FAOSTAT: '\u{1F33E}', FISHSTATJ: '\u{1F41F}', CITES: '\u{1F98F}', CUSTOM_API: '\u{1F50C}',
  FILE_EXCHANGE: '\u{1F4C1}', EMAIL: '\u{2709}', OTHER: '\u{26A1}',
};

/* ── Page ─────────────────────────────────────────────────────── */

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

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  function clearFilters() {
    setDirection('');
    setStatus('');
    setSystemType('');
    setPage(1);
  }

  const hasFilters = direction || status || systemType;

  return (
    <div className="space-y-6 p-6">
      {/* Header with gradient accent */}
      <div className="relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-transparent" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t('connections.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('connections.subtitle')}</p>
              </div>
            </div>
          </div>
          <Link
            href="/interop-hub/connections/new"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30"
          >
            <Plus className="h-4 w-4" /> {t('actions.newConnection')}
          </Link>
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
          <FilterPill
            key={s}
            label={s}
            active={status === s}
            onClick={() => { setStatus(s); setPage(1); }}
            dot={STATUS_DOT[s]}
          />
        ))}

        <div className="mx-2 h-5 w-px bg-border" />

        <span className="text-xs font-medium text-muted-foreground mr-1">{t('filter.systemType')}:</span>
        <FilterPill label={t('filter.all')} active={!systemType} onClick={() => { setSystemType(''); setPage(1); }} />
        {SYSTEM_TYPES.map((s) => (
          <FilterPill key={s} label={s} active={systemType === s} onClick={() => { setSystemType(s); setPage(1); }} />
        ))}

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-2 text-xs text-muted-foreground hover:text-foreground underline"
          >
            {t('filter.clear') || 'Clear all'}
          </button>
        )}
      </div>

      {/* Connection cards grid on lg, compact list on sm */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-card/50 backdrop-blur-sm border border-border/50" />
          ))}
        </div>
      ) : connections.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Link2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">{t('connections.empty')}</p>
          <Link
            href="/interop-hub/connections/new"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {t('actions.newConnection')}
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {connections.map((conn) => {
              const DirIcon = DIRECTION_ICON[conn.direction] ?? ArrowLeftRight;
              const isHovered = hoveredId === conn.id;
              return (
                <div
                  key={conn.id}
                  className="group relative rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-border"
                  onMouseEnter={() => setHoveredId(conn.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* System icon + name */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 text-2xl">
                      {SYSTEM_EMOJI[conn.externalSystem] ?? '\u{26A1}'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/interop-hub/connections/${conn.id}`}
                        className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1"
                      >
                        {conn.name}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{conn.externalSystem}</p>
                    </div>
                    {/* Status dot */}
                    <div className="flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[conn.status] ?? 'bg-gray-400')} />
                      <span className="text-xs text-muted-foreground">{conn.status}</span>
                    </div>
                  </div>

                  {/* Description */}
                  {conn.description && (
                    <p className="mt-3 text-xs text-muted-foreground line-clamp-2">
                      {conn.description}
                    </p>
                  )}

                  {/* Direction + meta row */}
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <DirIcon className="h-3.5 w-3.5" />
                      {t(`direction.${conn.direction}`)}
                    </span>
                    <span>{conn.transportType}</span>
                    <span className="ml-auto">
                      {conn.updatedAt ? new Date(conn.updatedAt).toLocaleDateString() : '-'}
                    </span>
                  </div>

                  {/* Action buttons (show on hover) */}
                  <div className={cn(
                    'absolute right-3 top-3 flex gap-1 transition-all duration-200',
                    isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
                  )}>
                    <IconBtn icon={TestTube} title={t('actions.test')} onClick={() => testMut.mutate(conn.id)} />
                    {conn.status !== 'ACTIVE' && (
                      <IconBtn icon={Play} title={t('actions.activate')} onClick={() => activateMut.mutate(conn.id)} className="text-emerald-600" />
                    )}
                    {conn.status === 'ACTIVE' && (
                      <IconBtn icon={Pause} title={t('actions.suspend')} onClick={() => suspendMut.mutate(conn.id)} className="text-amber-600" />
                    )}
                    <IconBtn
                      icon={Trash2}
                      title={t('actions.delete')}
                      onClick={() => { if (confirm(t('actions.confirmDelete'))) deleteMut.mutate(conn.id); }}
                      className="text-destructive"
                    />
                  </div>
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
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-xs font-medium transition-all hover:bg-accent disabled:opacity-40"
                >
                  {t('pagination.prev')}
                </button>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPage(page + 1)}
                  className="rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-xs font-medium transition-all hover:bg-accent disabled:opacity-40"
                >
                  {t('pagination.next')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────── */

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

function IconBtn({ icon: Icon, title, onClick, className }: {
  icon: React.ElementType; title: string; onClick: () => void; className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md bg-card border border-border/50 shadow-sm transition-all hover:bg-accent',
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
