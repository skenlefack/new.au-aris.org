'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  MapPin,
  Syringe,
  ChevronLeft,
  ChevronRight,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHealthEvents, type HealthEvent } from '@/lib/api/hooks';
import { TableSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { DomainCampaignsSection } from '@/components/domain/DomainCampaignsSection';
import { DomainMapSection } from '@/components/domain/DomainMapSection';
import { DomainStatisticsSection } from '@/components/domain/DomainStatisticsSection';
import { DomainCurveSection } from '@/components/domain/DomainCurveSection';
import { QuickAlertCard, type AlertField } from '@/components/domain/QuickAlertCard';
import { useDomainConfig } from '@/lib/hooks/use-domain-config';
import { useCollectionCampaigns } from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';

const ANIMAL_HEALTH_ALERT_FIELDS: AlertField[] = [
  { name: 'disease', label: 'Disease', type: 'text', placeholder: 'e.g. Foot-and-Mouth Disease', required: true },
  { name: 'species', label: 'Species', type: 'text', placeholder: 'e.g. Cattle', required: true },
  { name: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Rift Valley, KE', required: true },
  { name: 'severity', label: 'Severity', type: 'select', required: true, options: ['Low', 'Medium', 'High', 'Critical'] },
  { name: 'cases', label: 'Estimated Cases', type: 'text', placeholder: 'e.g. 50' },
];

const STATUS_BADGE: Record<string, string> = {
  suspected: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

const SEVERITY_BADGE: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function AnimalHealthPage() {
  const t = useTranslations('animalHealth');
  const { sections } = useDomainConfig('animal-health');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const limit = 10;

  // Fetch active campaigns for this domain to compute KPIs
  const campaignsQuery = useCollectionCampaigns({ domain: 'animal_health', limit: 20 });
  const campaigns: any[] = Array.isArray(campaignsQuery.data?.data) ? campaignsQuery.data.data : [];
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE');

  // Aggregate KPIs from campaign data
  const totalSubmissions = campaigns.reduce((s: number, c: any) => s + (c.totalSubmissions ?? 0), 0);
  const targetSubmissions = campaigns.reduce((s: number, c: any) => s + (c.targetSubmissions ?? 0), 0);
  const completionRate = targetSubmissions > 0 ? Math.round((totalSubmissions / targetSubmissions) * 100) : 0;

  // Fetch events from animal-health service
  const { data, isLoading, isError, error, refetch } = useHealthEvents({
    page,
    limit,
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
    search: search || undefined,
  });

  const events: HealthEvent[] = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 10 };
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/animal-health/map"
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <MapPin className="h-4 w-4" />
            {t('mapView')}
          </Link>
          <Link
            href="/animal-health/vaccination"
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Syringe className="h-4 w-4" />
            {t('vaccination')}
          </Link>
          <Link
            href="/animal-health/events/new"
            className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            {t('reportEvent')}
          </Link>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────── */}
      {sections.kpis && (
        campaignsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard
              label={t('activeCampaigns')}
              value={activeCampaigns.length}
              icon={<Activity className="h-5 w-5" />}
              color="#C62828"
            />
            <KpiCard
              label={t('totalSubmissions')}
              value={totalSubmissions}
              icon={<CheckCircle2 className="h-5 w-5" />}
              color="#2E7D32"
            />
            <KpiCard
              label={t('completionRate')}
              value={`${completionRate}%`}
              icon={<TrendingUp className="h-5 w-5" />}
              color="#1565C0"
            />
            <KpiCard
              label={t('totalEvents')}
              value={meta.total}
              icon={<AlertTriangle className="h-5 w-5" />}
              color="#E65100"
            />
          </div>
        )
      )}

      {/* ── Chart ────────────────────────────────────────── */}
      {sections.chart && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{t('eventOverview')}</h3>
          {campaigns.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {campaigns.slice(0, 4).map((c: any) => {
                const progress = c.targetSubmissions > 0
                  ? Math.round(((c.totalSubmissions ?? 0) / c.targetSubmissions) * 100)
                  : 0;
                const name = typeof c.name === 'object' ? (c.name?.en ?? c.name?.fr ?? Object.values(c.name)[0]) : c.name;
                return (
                  <div key={c.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-700 line-clamp-1 dark:text-gray-300">{name}</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{c.totalSubmissions ?? 0}</p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] text-gray-400">{progress}% {t('complete')}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">{t('noCampaignData')}</p>
          )}
        </div>
      )}

      {/* ── Map / Statistics / Curve ─────────────────────── */}
      {sections.map && <DomainMapSection domain="animal_health" />}
      {sections.statistics && <DomainStatisticsSection domain="animal_health" />}
      {sections.curve && <DomainCurveSection domain="animal_health" />}

      {/* ── Quick Links ──────────────────────────────────── */}
      {sections.quickLinks && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { href: '/animal-health/events/new', label: t('reportEvent'), icon: Plus, color: '#C62828' },
            { href: '/animal-health/map', label: t('mapView'), icon: MapPin, color: '#1565C0' },
            { href: '/animal-health/vaccination', label: t('vaccination'), icon: Syringe, color: '#2E7D32' },
            { href: '/collecte/campaigns?domain=animal_health', label: t('manageCampaigns'), icon: Clock, color: '#E65100' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${link.color}14`, color: link.color }}
              >
                <link.icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{link.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* ── Events Table ─────────────────────────────────── */}
      {sections.table && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('searchEvents')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                <option value="">{t('allStatus')}</option>
                <option value="suspected">{t('suspected')}</option>
                <option value="confirmed">{t('confirmed')}</option>
                <option value="resolved">{t('resolved')}</option>
                <option value="closed">{t('closed')}</option>
              </select>
              <select
                value={severityFilter}
                onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                <option value="">{t('allSeverity')}</option>
                <option value="low">{t('low')}</option>
                <option value="medium">{t('medium')}</option>
                <option value="high">{t('high')}</option>
                <option value="critical">{t('critical')}</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <TableSkeleton rows={7} cols={8} />
          ) : isError ? (
            <QueryError
              message={error instanceof Error ? error.message : 'Failed to load events'}
              onRetry={() => refetch()}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                      <th className="px-4 py-3 text-left font-medium text-gray-500">{t('disease')}</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">{t('country')}</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">{t('status')}</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">{t('severity')}</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">{t('cases')}</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">{t('deaths')}</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">{t('species')}</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">{t('reported')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {events.map((ev) => (
                      <tr key={ev.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/animal-health/events/${ev.id}`}
                            className="font-medium text-gray-900 hover:text-red-600 dark:text-white"
                          >
                            {ev.disease}
                          </Link>
                          {ev.diseaseCode && <p className="text-xs text-gray-400">{ev.diseaseCode}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {ev.country}
                          {ev.region && <p className="text-xs text-gray-400">{ev.region}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize', STATUS_BADGE[ev.status] ?? 'bg-gray-100 text-gray-600')}>
                            {ev.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize', SEVERITY_BADGE[ev.severity] ?? 'bg-gray-100 text-gray-600')}>
                            {ev.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{(ev.cases ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{(ev.deaths ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{(ev.speciesAffected ?? []).join(', ')}</td>
                        <td className="px-4 py-3 text-gray-500">{ev.reportedAt ? new Date(ev.reportedAt).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                    {events.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                          {t('noEventsFound')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {meta.total > 0 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
                  <p className="text-xs text-gray-500">
                    {t('showingEvents', { count: events.length.toString(), total: meta.total.toString() })}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 text-xs text-gray-600">
                      Page {page} / {totalPages || 1}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Campaigns & Alert ────────────────────────────── */}
      {(sections.campaigns || sections.alertForm) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {sections.campaigns && <DomainCampaignsSection domain="animal_health" />}
          {sections.alertForm && <QuickAlertCard domain="animal_health" alertFields={ANIMAL_HEALTH_ALERT_FIELDS} title={t('reportHealthEvent')} />}
        </div>
      )}
    </div>
  );
}

/* ── KPI Card ────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  icon,
  color,
  trend,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
}) {
  const formatted = typeof value === 'number'
    ? (value >= 1000 ? value.toLocaleString() : String(value))
    : value;

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      style={{ borderTop: `3px solid ${color}` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{formatted}</p>
          {trend !== undefined && (
            <div className={cn('mt-1 flex items-center gap-1 text-xs font-medium', trend >= 0 ? 'text-green-600' : 'text-red-600')}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}
