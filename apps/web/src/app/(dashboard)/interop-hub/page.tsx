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
import { KpiCardSkeleton } from '@/components/ui/Skeleton';

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={`rounded-md p-1.5 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

// ── Health dot ────────────────────────────────────────────────────────────────

const HEALTH_ICON: Record<string, { icon: React.ElementType; cls: string }> = {
  HEALTHY: { icon: CheckCircle2, cls: 'text-green-500' },
  DEGRADED: { icon: AlertTriangle, cls: 'text-amber-500' },
  DOWN: { icon: XCircle, cls: 'text-red-500' },
  UNKNOWN: { icon: HelpCircle, cls: 'text-gray-400' },
};

function HealthRow({ item }: { item: HubDashboardHealth }) {
  const cfg = HEALTH_ICON[item.status] ?? HEALTH_ICON.UNKNOWN;
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className={`h-4 w-4 shrink-0 ${cfg.cls}`} />
      <span className="flex-1 truncate text-sm font-medium">{item.connectionName}</span>
      <span className="text-xs text-muted-foreground">{item.status}</span>
    </div>
  );
}

// ── Simple bar chart ──────────────────────────────────────────────────────────

function VolumeChart({ data }: { data: HubDashboardVolume[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex h-40 items-end gap-1">
      {data.map((d, i) => {
        const inH = Math.max((d.inbound / max) * 100, 2);
        const outH = Math.max((d.outbound / max) * 100, 2);
        return (
          <div key={i} className="group relative flex flex-1 flex-col items-center gap-0.5" title={`${d.period}: In ${d.inbound}, Out ${d.outbound}`}>
            <div className="flex w-full items-end gap-px" style={{ height: '100%' }}>
              <div className="flex-1 rounded-t bg-blue-500 transition-all" style={{ height: `${inH}%` }} />
              <div className="flex-1 rounded-t bg-emerald-500 transition-all" style={{ height: `${outH}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Transaction status badge ──────────────────────────────────────────────────

const TX_STATUS_CLS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-gray-100 text-gray-700',
  AWAITING_APPROVAL: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/interop-hub/connections/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {t('actions.newConnection')}
          </Link>
          <Link
            href="/interop-hub/pipelines"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            <GitBranch className="h-4 w-4" /> {t('nav.pipelines')}
          </Link>
          <Link
            href="/interop-hub/inbox"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            <Inbox className="h-4 w-4" /> {t('nav.inbox')}
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      {loadingOverview ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label={t('kpi.activeConnections')}
            value={ov?.activeConnections ?? 0}
            icon={Link2}
            color="bg-blue-100 text-blue-600"
          />
          <KpiCard
            label={t('kpi.activePipelines')}
            value={ov?.activePipelines ?? 0}
            icon={GitBranch}
            color="bg-emerald-100 text-emerald-600"
          />
          <KpiCard
            label={t('kpi.transactionsToday')}
            value={ov?.totalTransactions ?? 0}
            icon={ArrowLeftRight}
            color="bg-indigo-100 text-indigo-600"
          />
          <KpiCard
            label={t('kpi.errorRate')}
            value={`${((ov?.failedTransactions ?? 0) > 0 && (ov?.totalTransactions ?? 0) > 0
              ? Math.round(((ov?.failedTransactions ?? 0) / (ov?.totalTransactions ?? 1)) * 100)
              : 0)}%`}
            icon={AlertTriangle}
            color="bg-red-100 text-red-600"
          />
          <KpiCard
            label={t('kpi.pendingReview')}
            value={ov?.pendingTransactions ?? 0}
            icon={Inbox}
            color="bg-purple-100 text-purple-600"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Volume chart */}
        <div className="col-span-2 rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t('dashboard.volume')}</h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" /> {t('direction.INBOUND')}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> {t('direction.OUTBOUND')}
              </span>
            </div>
          </div>
          {volData.length > 0 ? (
            <VolumeChart data={volData} />
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              {t('dashboard.noVolume')}
            </div>
          )}
        </div>

        {/* Connection Health */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">{t('dashboard.health')}</h3>
          {healthItems.length > 0 ? (
            <div className="divide-y">
              {healthItems.map((h) => (
                <HealthRow key={h.connectionId} item={h} />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('dashboard.noConnections')}
            </p>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-sm font-semibold">{t('dashboard.recentTransactions')}</h3>
          <Link
            href="/interop-hub/transactions"
            className="text-xs font-medium text-primary hover:underline"
          >
            {t('actions.viewAll')}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t('col.id')}</th>
                <th className="px-4 py-3 font-medium">{t('col.type')}</th>
                <th className="px-4 py-3 font-medium">{t('col.entity')}</th>
                <th className="px-4 py-3 font-medium">{t('col.status')}</th>
                <th className="px-4 py-3 font-medium">{t('col.date')}</th>
              </tr>
            </thead>
            <tbody>
              {recentItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    {t('dashboard.noRecent')}
                  </td>
                </tr>
              ) : (
                recentItems.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 font-mono text-xs">{item.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">{item.type}</td>
                    <td className="px-4 py-3">{item.entityName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TX_STATUS_CLS[item.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
