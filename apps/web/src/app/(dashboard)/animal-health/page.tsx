'use client';

import React, { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHealthEvents, type HealthEvent } from '@/lib/api/hooks';
import { Skeleton } from '@/components/ui/Skeleton';
import { DomainCampaignsSection } from '@/components/domain/DomainCampaignsSection';
import { DomainMapSection } from '@/components/domain/DomainMapSection';
import { DomainStatisticsSection } from '@/components/domain/DomainStatisticsSection';
import { DomainCurveSection } from '@/components/domain/DomainCurveSection';
import { useDomainConfig } from '@/lib/hooks/use-domain-config';
import { useCollectionCampaigns } from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';

const STATUS_CONFIG: Record<string, { badge: string; dot: string }> = {
  suspected: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' },
  confirmed: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
  resolved: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500' },
  closed: { badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', dot: 'bg-gray-400' },
};

const SEVERITY_CONFIG: Record<string, { badge: string; color: string }> = {
  low: { badge: 'bg-green-100 text-green-700', color: '#16a34a' },
  medium: { badge: 'bg-yellow-100 text-yellow-700', color: '#ca8a04' },
  high: { badge: 'bg-orange-100 text-orange-700', color: '#ea580c' },
  critical: { badge: 'bg-red-100 text-red-700', color: '#dc2626' },
};

export default function AnimalHealthPage() {
  const t = useTranslations('animalHealth');
  const { sections } = useDomainConfig('animal-health');

  // Fetch active campaigns for this domain to compute KPIs
  const campaignsQuery = useCollectionCampaigns({ domain: 'animal_health', limit: 20 });
  const campaigns: any[] = Array.isArray(campaignsQuery.data?.data) ? campaignsQuery.data.data : [];
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE');

  // Aggregate KPIs from campaign data
  const totalSubmissions = campaigns.reduce((s: number, c: any) => s + (c.totalSubmissions ?? 0), 0);
  const targetSubmissions = campaigns.reduce((s: number, c: any) => s + (c.targetSubmissions ?? 0), 0);
  const completionRate = targetSubmissions > 0 ? Math.round((totalSubmissions / targetSubmissions) * 100) : 0;

  // Fetch latest events from animal-health service
  const { data, isLoading } = useHealthEvents({ page: 1, limit: 6 });
  const events: HealthEvent[] = data?.data ?? [];
  const totalEvents = data?.meta?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
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
            <KpiCard label={t('activeCampaigns')} value={activeCampaigns.length} icon={<Activity className="h-5 w-5" />} color="#C62828" />
            <KpiCard label={t('totalSubmissions')} value={totalSubmissions} icon={<CheckCircle2 className="h-5 w-5" />} color="#2E7D32" />
            <KpiCard label={t('completionRate')} value={`${completionRate}%`} icon={<TrendingUp className="h-5 w-5" />} color="#1565C0" />
            <KpiCard label={t('totalEvents')} value={totalEvents} icon={<AlertTriangle className="h-5 w-5" />} color="#E65100" />
          </div>
        )
      )}

      {/* ── Campaign Overview Carousel ────────────────────── */}
      {sections.chart && <CampaignCarousel campaigns={campaigns} isLoading={campaignsQuery.isLoading} t={t} />}

      {/* ── Map + Statistics ─────────────────────────────── */}
      {(sections.map || sections.statistics) && (
        <div className={cn('grid gap-6', sections.map && sections.statistics ? 'lg:grid-cols-2' : 'grid-cols-1')}>
          {sections.map && <DomainMapSection domain="animal_health" />}
          {sections.statistics && <DomainStatisticsSection domain="animal_health" />}
        </div>
      )}

      {/* ── Curve ────────────────────────────────────────── */}
      {sections.curve && <DomainCurveSection domain="animal_health" />}

      {/* ── Recent Events (modern card feed) ─────────────── */}
      {sections.table && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('recentEvents')}</h3>
            <Link
              href="/animal-health/events"
              className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
            >
              {t('viewAllEvents')} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <AlertTriangle className="h-10 w-10 text-gray-200 dark:text-gray-600" />
              <p className="mt-3 text-sm text-gray-400">{t('noEventsFound')}</p>
              <Link
                href="/animal-health/events/new"
                className="mt-3 flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
              >
                <Plus className="h-4 w-4" /> {t('reportEvent')}
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((ev) => {
                const status = STATUS_CONFIG[ev.status] ?? STATUS_CONFIG.closed;
                const severity = SEVERITY_CONFIG[ev.severity] ?? SEVERITY_CONFIG.low;
                return (
                  <Link
                    key={ev.id}
                    href={`/animal-health/events/${ev.id}`}
                    className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
                  >
                    {/* Severity accent */}
                    <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: severity.color }} />

                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full', status.dot)} />
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', status.badge)}>
                            {ev.status}
                          </span>
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', severity.badge)}>
                            {ev.severity}
                          </span>
                        </div>
                        <h4 className="mt-2 text-sm font-semibold text-gray-900 group-hover:text-red-600 dark:text-white">
                          {ev.disease}
                        </h4>
                        {ev.diseaseCode && (
                          <p className="text-[10px] font-mono text-gray-400">{ev.diseaseCode}</p>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-red-500" />
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      {ev.country && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {ev.country}{ev.region ? `, ${ev.region}` : ''}
                        </span>
                      )}
                      {ev.reportedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(ev.reportedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{(ev.cases ?? 0).toLocaleString()}</p>
                        <p className="text-[10px] text-gray-400">{t('cases')}</p>
                      </div>
                      <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{(ev.deaths ?? 0).toLocaleString()}</p>
                        <p className="text-[10px] text-gray-400">{t('deaths')}</p>
                      </div>
                      {(ev.speciesAffected ?? []).length > 0 && (
                        <>
                          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-gray-500">{(ev.speciesAffected ?? []).join(', ')}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Quick Links ──────────────────────────────────── */}
      {sections.quickLinks && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { href: '/animal-health/events/new', label: t('reportEvent'), desc: t('reportEventDesc'), icon: AlertTriangle, color: '#C62828' },
            { href: '/animal-health/map', label: t('mapView'), desc: t('mapViewDesc'), icon: MapPin, color: '#1565C0' },
            { href: '/collecte/campaigns?domain=animal_health', label: t('manageCampaigns'), desc: t('manageCampaignsDesc'), icon: FileText, color: '#E65100' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${link.color}14`, color: link.color }}
              >
                <link.icon className="h-5 w-5" />
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-white">{link.label}</span>
                <p className="mt-0.5 text-xs text-gray-400">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Campaigns & Alert Form ───────────────────────── */}
      {(sections.campaigns || sections.alertForm) && (
        <div className={cn('grid gap-6', sections.campaigns && sections.alertForm ? 'lg:grid-cols-2' : 'grid-cols-1')}>
          {sections.campaigns && <DomainCampaignsSection domain="animal_health" />}
          {sections.alertForm && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('alertForms')}</h3>
              </div>
              <p className="mt-1 text-xs text-gray-400">{t('alertFormsDesc')}</p>
              <div className="mt-4 space-y-2">
                <Link
                  href="/collecte/forms?domain=animal_health"
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('manageAlertForms')}</p>
                      <p className="text-[10px] text-gray-400">{t('manageAlertFormsDesc')}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300" />
                </Link>
                <Link
                  href="/animal-health/events/new"
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      <Plus className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('reportEvent')}</p>
                      <p className="text-[10px] text-gray-400">{t('submitNewEvent')}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300" />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── KPI Card ────────────────────────────────────────── */

function KpiCard({ label, value, icon, color, trend }: {
  label: string; value: number | string; icon: React.ReactNode; color: string; trend?: number;
}) {
  const formatted = typeof value === 'number' ? (value >= 1000 ? value.toLocaleString() : String(value)) : value;
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800" style={{ borderTop: `3px solid ${color}` }}>
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
        <span className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15`, color }}>{icon}</span>
      </div>
    </div>
  );
}

/* ── Campaign Carousel ───────────────────────────────── */

const CAMPAIGN_COLORS = ['#C62828', '#1565C0', '#2E7D32', '#E65100', '#6A1B9A', '#00838F'];

function CampaignCarousel({ campaigns, isLoading, t }: { campaigns: any[]; isLoading: boolean; t: (key: string) => string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
    setTimeout(updateScrollState, 350);
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <Skeleton className="mb-4 h-6 w-48" />
        <div className="flex gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-72 shrink-0 rounded-xl" />)}</div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">{t('eventOverview')}</h3>
        <p className="py-8 text-center text-sm text-gray-400">{t('noCampaignData')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('eventOverview')}</h3>
          <p className="mt-0.5 text-xs text-gray-400">{campaigns.length} {t('activeCampaigns').toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => scroll('left')} disabled={!canScrollLeft} className="rounded-full border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 dark:border-gray-700 dark:hover:bg-gray-700"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => scroll('right')} disabled={!canScrollRight} className="rounded-full border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 dark:border-gray-700 dark:hover:bg-gray-700"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div ref={scrollRef} onScroll={updateScrollState} className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
        {campaigns.map((c: any, idx: number) => {
          const progress = c.targetSubmissions > 0 ? Math.min(100, Math.round(((c.totalSubmissions ?? 0) / c.targetSubmissions) * 100)) : 0;
          const name = typeof c.name === 'object' ? (c.name?.en ?? c.name?.fr ?? Object.values(c.name)[0]) : c.name;
          const color = CAMPAIGN_COLORS[idx % CAMPAIGN_COLORS.length];
          return (
            <Link key={c.id} href={`/collecte/campaigns/${c.id}`} className="group relative w-72 shrink-0 snap-start overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-gray-700 dark:from-gray-800 dark:to-gray-800/80">
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ backgroundColor: color }}><Activity className="h-5 w-5" /></div>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', c.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400')}>{c.status === 'ACTIVE' ? 'Active' : c.status}</span>
              </div>
              <h4 className="mt-3 text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-red-600 dark:text-white">{name}</h4>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{(c.totalSubmissions ?? 0).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">{c.targetSubmissions ? `/ ${c.targetSubmissions.toLocaleString()} target` : 'submissions'}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold" style={{ color }}>{progress}%</p>
                  <p className="text-[10px] text-gray-400">{t('complete')}</p>
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: color }} />
              </div>
              {(c.startDate || c.endDate) && (
                <p className="mt-2 text-[10px] text-gray-400">
                  {c.startDate ? new Date(c.startDate).toLocaleDateString() : ''}{c.startDate && c.endDate ? ' → ' : ''}{c.endDate ? new Date(c.endDate).toLocaleDateString() : ''}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
