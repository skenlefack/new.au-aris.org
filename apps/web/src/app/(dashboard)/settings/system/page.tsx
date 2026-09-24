'use client';

import React from 'react';
import { useTranslations } from '@/lib/i18n/translations';
import { Server, Activity, Database, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { SettingsBackButton } from '@/components/settings/SettingsBackButton';
import { SuperAdminGuard } from '@/components/settings/SuperAdminGuard';

function useSystemMetrics() {
  return useQuery<{ totalUsers: number; totalTenants: number; healthyServices: number; totalServices: number }>({
    queryKey: ['admin', 'system-metrics'],
    queryFn: async () => {
      const res: any = await apiClient.get('/admin/system/metrics');
      return res?.data ?? res;
    },
    refetchInterval: 30_000,
  });
}

function useServicesHealth() {
  return useQuery<Array<{ name: string; port: number; group: string; status: string; responseTime?: number; uptime?: number; memoryUsage?: number }>>({
    queryKey: ['admin', 'services-health'],
    queryFn: async () => {
      const res: any = await apiClient.get('/admin/services/health');
      return res?.data ?? res;
    },
    refetchInterval: 15_000,
  });
}

export default function SystemInfoPage() {
  const t = useTranslations('settings');
  const { data: metrics } = useSystemMetrics();
  const { data: services, isLoading, refetch } = useServicesHealth();

  const healthyCount = services?.filter(s => s.status === 'healthy').length ?? 0;
  const totalCount = services?.length ?? 22;

  return (
    <SuperAdminGuard>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('systemInfo')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('systemInfoDesc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <SettingsBackButton />
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Version info */}
      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard icon={<Server className="h-5 w-5" />} label={t('version')} value="4.0.0" color="#006B3F" />
        <InfoCard icon={<Database className="h-5 w-5" />} label={t('services')} value={`${healthyCount}/${totalCount} active`} color="#1565C0" />
        <InfoCard
          icon={<Activity className="h-5 w-5" />}
          label={t('status')}
          value={healthyCount === totalCount ? t('healthy') : `${totalCount - healthyCount} down`}
          color={healthyCount === totalCount ? '#2E7D32' : '#C62828'}
        />
      </div>

      {/* KPIs from API */}
      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Users" value={metrics.totalUsers} />
          <KpiCard label="Total Tenants" value={metrics.totalTenants} />
          <KpiCard label="Healthy Services" value={metrics.healthyServices} />
          <KpiCard label="Total Services" value={metrics.totalServices} />
        </div>
      )}

      {/* Stack */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{t('technologyStack')}</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STACK_ITEMS.map(({ label, value }) => (
            <div key={label} className="flex justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
              <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
              <span className="text-xs font-medium text-gray-900 dark:text-white">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Services health — real-time from API */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{t('serviceHealth')}</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ))
          ) : (
            (services ?? []).map((svc) => (
              <div key={svc.name} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
                <span className={`h-2 w-2 rounded-full ${svc.status === 'healthy' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-xs font-medium text-gray-900 dark:text-white">{svc.name}</span>
                <span className="ml-auto text-[10px] text-gray-400">:{svc.port}</span>
                {svc.uptime != null && svc.uptime > 0 && (
                  <span className="text-[10px] text-gray-400">{formatUptime(svc.uptime)}</span>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
    </SuperAdminGuard>
  );
}

function InfoCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}14`, color }}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</p>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d`;
  return `${hours}h`;
}

const STACK_ITEMS = [
  { label: 'Runtime', value: 'Node.js 22 LTS' },
  { label: 'Backend', value: 'Fastify + TypeScript' },
  { label: 'Frontend', value: 'Next.js 14' },
  { label: 'Database', value: 'PostgreSQL 16 + PostGIS' },
  { label: 'ORM', value: 'Prisma 6.2' },
  { label: 'Cache', value: 'Redis 7' },
  { label: 'Message Broker', value: 'Kafka 3.7 KRaft' },
  { label: 'Search', value: 'OpenSearch 2' },
  { label: 'Object Storage', value: 'MinIO (S3)' },
  { label: 'Proxy', value: 'PgBouncer + Traefik' },
  { label: 'Monitoring', value: 'Prometheus + Grafana' },
  { label: 'Auth', value: 'JWT RS256 + MFA TOTP' },
];
