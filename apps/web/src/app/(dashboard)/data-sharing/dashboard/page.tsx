'use client';

// Data Sharing — continental read-only dashboard.
// Visible to CONTINENTAL_ADMIN, SUPER_ADMIN, REC_ADMIN.

import Link from 'next/link';
import { ArrowLeft, Activity, AlarmClock, FileSignature, Eye, Info } from 'lucide-react';
import {
  useDataShareDashboard,
  SHARE_STATUSES,
  statusBadgeClasses,
} from '@/lib/api/data-sharing';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations } from '@/lib/i18n/translations';
import { ForbiddenPage } from '@/components/ui/ForbiddenPage';

const ALLOWED_ROLES = new Set(['CONTINENTAL_ADMIN', 'SUPER_ADMIN', 'REC_ADMIN']);

export default function DataShareDashboardPage() {
  const t = useTranslations('dataSharing');
  const tCommon = useTranslations('common');
  const user = useAuthStore((s) => s.user);
  const allowed = !!user && ALLOWED_ROLES.has(user.role);

  const { data, isLoading } = useDataShareDashboard();
  const stats = data?.data;

  if (!allowed) {
    return <ForbiddenPage />;
  }

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/data-sharing"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {tCommon('back')}
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
          <Info className="h-3.5 w-3.5" />
          {t('dashboard.readOnlyNote')}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<FileSignature className="h-5 w-5" />}
          label={t('dashboard.totalAgreements')}
          value={stats?.totalAgreements ?? 0}
          loading={isLoading}
        />
        <Kpi
          icon={<Activity className="h-5 w-5" />}
          label={t('dashboard.activeAgreements')}
          value={stats?.activeAgreements ?? 0}
          loading={isLoading}
          highlight
        />
        <Kpi
          icon={<AlarmClock className="h-5 w-5" />}
          label={t('dashboard.expiringSoon')}
          value={stats?.expiringWithin30Days ?? 0}
          loading={isLoading}
        />
        <Kpi
          icon={<Eye className="h-5 w-5" />}
          label={t('dashboard.recentAccesses')}
          value={stats?.totalAccessesLast30Days ?? 0}
          loading={isLoading}
        />
      </div>

      {/* By status / By domain */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">{t('dashboard.byStatus')}</h2>
          <div className="space-y-2">
            {SHARE_STATUSES.map((s) => {
              const count = stats?.byStatus?.[s] ?? 0;
              const max = stats ? Math.max(1, ...Object.values(stats.byStatus ?? {})) : 1;
              const pct = (count / max) * 100;
              return (
                <div key={s} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 font-medium ${statusBadgeClasses(s)}`}
                    >
                      {t(`status.${s.toLowerCase()}`)}
                    </span>
                    <span className="font-mono">{count}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">{t('dashboard.byDomain')}</h2>
          <div className="space-y-2">
            {stats && Object.keys(stats.byDomain ?? {}).length > 0 ? (
              Object.entries(stats.byDomain).map(([domain, count]) => {
                const max = Math.max(1, ...Object.values(stats.byDomain));
                const pct = (count / max) * 100;
                return (
                  <div key={domain} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{domain}</span>
                      <span className="font-mono">{count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">{tCommon('noData')}</p>
            )}
          </div>
        </section>
      </div>

      {/* Top owners / recipients */}
      <div className="grid gap-4 md:grid-cols-2">
        <TopList title={t('dashboard.topOwners')} items={stats?.topOwners ?? []} />
        <TopList title={t('dashboard.topRecipients')} items={stats?.topRecipients ?? []} />
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  loading,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  loading?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-5 ${
        highlight ? 'border-primary/30 bg-primary/5' : 'bg-card'
      }`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-bold">
        {loading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" /> : value}
      </p>
    </div>
  );
}

function TopList({
  title,
  items,
}: {
  title: string;
  items: Array<{ tenantId: string; count: number }>;
}) {
  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {items.slice(0, 10).map((it, i) => (
            <li key={it.tenantId} className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-muted/30">
              <span className="flex items-center gap-2">
                <span className="w-5 text-xs text-muted-foreground">#{i + 1}</span>
                <span className="font-mono text-xs">{it.tenantId.slice(0, 12)}</span>
              </span>
              <span className="font-mono text-xs">{it.count}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
