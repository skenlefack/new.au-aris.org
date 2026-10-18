'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Link2,
  GitBranch,
  ArrowLeftRight,
  AlertTriangle,
  Inbox,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useHubDashboardOverview,
  useHubDashboardVolume,
  useHubDashboardRecent,
  useHubDashboardHealth,
  type HubDashboardVolume,
  type HubDashboardHealth,
} from '@/lib/api/hub-hooks';
import { cn } from '@/lib/utils';

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  gradient,
  trend,
  trendLabel,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  gradient: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;
  const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-muted-foreground';

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-transparent group-hover:from-primary/[0.02] group-hover:to-primary/[0.06] transition-all duration-300" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br', gradient)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
        {trend && trendLabel && TrendIcon && (
          <div className={cn('mt-1.5 flex items-center gap-1 text-[11px] font-medium', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            <span>{trendLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Health Card ──────────────────────────────────────────────────────────────

const HEALTH_CONFIG: Record<string, { icon: React.ElementType; dotClass: string; barClass: string; label: string }> = {
  HEALTHY: { icon: CheckCircle2, dotClass: 'bg-emerald-500', barClass: 'bg-emerald-500', label: 'Healthy' },
  DEGRADED: { icon: AlertTriangle, dotClass: 'bg-amber-500', barClass: 'bg-amber-500', label: 'Degraded' },
  DOWN: { icon: XCircle, dotClass: 'bg-red-500', barClass: 'bg-red-500', label: 'Down' },
  UNKNOWN: { icon: HelpCircle, dotClass: 'bg-gray-400', barClass: 'bg-gray-400', label: 'Unknown' },
};

function HealthItem({ item }: { item: HubDashboardHealth }) {
  const cfg = HEALTH_CONFIG[item.status] ?? HEALTH_CONFIG.UNKNOWN;
  const successRate = Math.max(0, 100 - (item.errorRate ?? 0));
  const lastCheck = item.lastCheck ? formatRelativeTime(item.lastCheck) : '--';

  return (
    <div className="group/health rounded-lg border border-border/30 bg-background/50 p-3 transition-all duration-200 hover:border-border/60 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div className="relative">
          <span className={cn('block h-2.5 w-2.5 rounded-full', cfg.dotClass)} />
          {item.status === 'HEALTHY' && (
            <span className={cn('absolute inset-0 h-2.5 w-2.5 rounded-full animate-ping opacity-30', cfg.dotClass)} />
          )}
        </div>
        <span className="flex-1 truncate text-sm font-medium">{item.connectionName}</span>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{cfg.label}</span>
      </div>

      {/* Progress bar */}
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
        <div
          className={cn('h-full rounded-full transition-all duration-500', cfg.barClass)}
          style={{ width: `${successRate}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{successRate.toFixed(0)}% success</span>
        <span>{lastCheck}</span>
      </div>
    </div>
  );
}

// ── Volume Chart ─────────────────────────────────────────────────────────────

function VolumeChart({ data }: { data: HubDashboardVolume[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="relative">
      {/* Grid lines */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border-b border-border/20" />
        ))}
      </div>

      <div className="relative flex h-48 items-end gap-1.5 px-1">
        {data.map((d, i) => {
          const inH = Math.max((d.inbound / max) * 100, 2);
          const outH = Math.max((d.outbound / max) * 100, 2);
          const isHovered = hoveredIdx === i;

          return (
            <div
              key={i}
              className="group/bar relative flex flex-1 flex-col items-center"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-lg border border-border/50 bg-popover px-3 py-2 text-xs shadow-lg">
                  <div className="font-medium mb-0.5">{d.period}</div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-blue-500" />
                      {d.inbound}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                      {d.outbound}
                    </span>
                  </div>
                  {/* Arrow */}
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 border-b border-r border-border/50 bg-popover" />
                </div>
              )}

              <div className="flex w-full items-end gap-0.5" style={{ height: '100%' }}>
                <div
                  className={cn(
                    'flex-1 rounded-t-md bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-200',
                    isHovered && 'from-blue-500 to-blue-300 shadow-sm shadow-blue-500/20',
                  )}
                  style={{ height: `${inH}%` }}
                />
                <div
                  className={cn(
                    'flex-1 rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-200',
                    isHovered && 'from-emerald-500 to-emerald-300 shadow-sm shadow-emerald-500/20',
                  )}
                  style={{ height: `${outH}%` }}
                />
              </div>

              {/* X-axis label */}
              <span className={cn(
                'mt-2 text-[9px] text-muted-foreground truncate max-w-full transition-colors',
                isHovered && 'text-foreground font-medium',
              )}>
                {d.period.length > 5 ? d.period.slice(-5) : d.period}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Transaction Status Badge ─────────────────────────────────────────────────

const TX_STATUS: Record<string, { dot: string; bg: string; text: string }> = {
  COMPLETED: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400' },
  FAILED: { dot: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-700 dark:text-red-400' },
  IN_PROGRESS: { dot: 'bg-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400' },
  PENDING: { dot: 'bg-gray-400', bg: 'bg-gray-400/10', text: 'text-gray-600 dark:text-gray-400' },
  AWAITING_APPROVAL: { dot: 'bg-violet-500', bg: 'bg-violet-500/10', text: 'text-violet-700 dark:text-violet-400' },
  CANCELLED: { dot: 'bg-gray-400', bg: 'bg-gray-400/10', text: 'text-gray-500' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = TX_STATUS[status] ?? TX_STATUS.PENDING;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium', cfg.bg, cfg.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InteropHubDashboardPage() {
  const t = useTranslations('interopHub');
  const [period] = useState<'day' | 'week' | 'month'>('day');

  const { data: overview, isLoading: loadingOverview } = useHubDashboardOverview();
  const { data: volume } = useHubDashboardVolume(period);
  const { data: recent } = useHubDashboardRecent();
  const { data: health } = useHubDashboardHealth();

  const ov = overview?.data;
  const volData = volume?.data ?? [];
  const recentItems = recent?.data ?? [];
  const healthItems = health?.data ?? [];

  const errorRate =
    (ov?.failedTransactions ?? 0) > 0 && (ov?.totalTransactions ?? 0) > 0
      ? Math.round(((ov?.failedTransactions ?? 0) / (ov?.totalTransactions ?? 1)) * 100)
      : 0;

  return (
    <div className="space-y-6 p-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-transparent border border-border/30 p-6 md:p-8">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-primary/3 blur-2xl" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {t('dashboard.title')}
              </span>
            </h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/interop-hub/connections/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25"
            >
              <Plus className="h-4 w-4" /> {t('actions.newConnection')}
            </Link>
            <Link
              href="/interop-hub/pipelines"
              className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm px-4 py-2.5 text-sm font-medium transition-all hover:bg-accent hover:shadow-sm"
            >
              <GitBranch className="h-4 w-4" /> {t('nav.pipelines')}
            </Link>
            <Link
              href="/interop-hub/inbox"
              className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm px-4 py-2.5 text-sm font-medium transition-all hover:bg-accent hover:shadow-sm"
            >
              <Inbox className="h-4 w-4" /> {t('nav.inbox')}
            </Link>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────── */}
      {loadingOverview ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-border/50 bg-card/50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label={t('kpi.activeConnections')}
            value={ov?.activeConnections ?? 0}
            icon={Link2}
            gradient="from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400"
            trend="up"
            trendLabel="+2 this week"
          />
          <KpiCard
            label={t('kpi.activePipelines')}
            value={ov?.activePipelines ?? 0}
            icon={GitBranch}
            gradient="from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400"
            trend="neutral"
            trendLabel="stable"
          />
          <KpiCard
            label={t('kpi.transactionsToday')}
            value={ov?.totalTransactions ?? 0}
            icon={ArrowLeftRight}
            gradient="from-indigo-500/20 to-indigo-500/5 text-indigo-600 dark:text-indigo-400"
            trend="up"
            trendLabel="+12%"
          />
          <KpiCard
            label={t('kpi.errorRate')}
            value={`${errorRate}%`}
            icon={AlertTriangle}
            gradient="from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400"
            trend={errorRate > 5 ? 'down' : 'up'}
            trendLabel={errorRate > 5 ? `${errorRate}% errors` : 'within SLA'}
          />
          <KpiCard
            label={t('kpi.pendingReview')}
            value={ov?.pendingTransactions ?? 0}
            icon={Clock}
            gradient="from-violet-500/20 to-violet-500/5 text-violet-600 dark:text-violet-400"
          />
        </div>
      )}

      {/* ── Main Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Volume Chart */}
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-sm">
          <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold">{t('dashboard.volume')}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Transaction volume over time</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-blue-600 to-blue-400" />
                <span className="text-muted-foreground">{t('direction.INBOUND')}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-emerald-600 to-emerald-400" />
                <span className="text-muted-foreground">{t('direction.OUTBOUND')}</span>
              </span>
            </div>
          </div>
          <div className="p-5">
            {volData.length > 0 ? (
              <VolumeChart data={volData} />
            ) : (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Activity className="h-8 w-8 opacity-30" />
                <span className="text-sm">{t('dashboard.noVolume')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Connection Health */}
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-sm">
          <div className="border-b border-border/30 px-5 py-4">
            <h3 className="text-sm font-semibold">{t('dashboard.health')}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Real-time connection status</p>
          </div>
          <div className="p-4">
            {healthItems.length > 0 ? (
              <div className="space-y-2.5">
                {healthItems.map((h) => (
                  <HealthItem key={h.connectionId} item={h} />
                ))}
              </div>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Link2 className="h-8 w-8 opacity-30" />
                <span className="text-sm">{t('dashboard.noConnections')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Transactions ──────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-sm">
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">{t('dashboard.recentTransactions')}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Latest data exchange activity</p>
          </div>
          <Link
            href="/interop-hub/transactions"
            className="group/link inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {t('actions.viewAll')}
            <ArrowRight className="h-3 w-3 transition-transform group-hover/link:translate-x-0.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 text-left">
                <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('col.id')}</th>
                <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Direction</th>
                <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('col.type')}</th>
                <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('col.entity')}</th>
                <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('col.status')}</th>
                <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('col.date')}</th>
              </tr>
            </thead>
            <tbody>
              {recentItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ArrowLeftRight className="h-8 w-8 opacity-30" />
                      <span className="text-sm">{t('dashboard.noRecent')}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                recentItems.map((item, idx) => {
                  const isInbound = item.action?.toLowerCase().includes('inbound') || item.type === 'TRANSACTION';
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        'group/row border-b border-border/20 last:border-0 transition-colors hover:bg-muted/30',
                        idx % 2 === 1 && 'bg-muted/10',
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-muted-foreground group-hover/row:text-foreground transition-colors">
                          {item.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {isInbound ? (
                          <ArrowDownLeft className="h-4 w-4 text-blue-500" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-medium">{item.type}</td>
                      <td className="px-5 py-3.5 text-xs">{item.entityName}</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {formatRelativeTime(item.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
