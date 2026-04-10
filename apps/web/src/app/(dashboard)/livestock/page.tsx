'use client';

import React, { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  MapPin,
  Clock,
  FileText,
  ArrowRight,
  Globe,
  BarChart3,
  Route,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { CampaignDataDashboard } from '@/components/domain/CampaignDataDashboard';
import { useDomainConfig } from '@/lib/hooks/use-domain-config';
import { useCollectionCampaigns } from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';

const LIVESTOCK_ALERT_TEMPLATE_ID = '28f55819-cee4-429a-afa5-505e9966d72b';

export default function LivestockPage() {
  const t = useTranslations('livestock');
  const { sections } = useDomainConfig('livestock-prod');

  const campaignsQuery = useCollectionCampaigns({ domain: 'livestock', limit: 20 });
  const campaigns: any[] = Array.isArray(campaignsQuery.data?.data) ? campaignsQuery.data.data : [];
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE');

  const totalSubmissions = campaigns.reduce((s: number, c: any) => s + (c.totalSubmissions ?? 0), 0);
  const targetSubmissions = campaigns.reduce((s: number, c: any) => s + (c.targetSubmissions ?? 0), 0);
  const completionRate = targetSubmissions > 0 ? Math.round((totalSubmissions / targetSubmissions) * 100) : 0;

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
            href={`/collecte/forms/${LIVESTOCK_ALERT_TEMPLATE_ID}/fill?returnTo=/livestock`}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700"
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
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard label={t('activeCampaigns')} value={activeCampaigns.length} icon={<Activity className="h-5 w-5" />} color="#E65100" />
            <KpiCard label={t('totalSubmissions')} value={totalSubmissions} icon={<CheckCircle2 className="h-5 w-5" />} color="#2E7D32" />
            <KpiCard label={t('completionRate')} value={`${completionRate}%`} icon={<TrendingUp className="h-5 w-5" />} color="#1565C0" />
            <KpiCard label={t('activeCorridors')} value={activeCampaigns.length > 0 ? campaigns.length : 0} icon={<Route className="h-5 w-5" />} color="#6A1B9A" />
          </div>
        )
      )}

      {/* ── Campaign Carousel ────────────────────────────── */}
      {sections.chart && <CampaignCarousel campaigns={campaigns} isLoading={campaignsQuery.isLoading} t={t} />}

      {/* ── Campaign Data Dashboard (Map + Statistics + Curve) ── */}
      {(sections.map || sections.statistics || sections.curve) && (
        <CampaignDataDashboard domain="livestock" showMap={sections.map} showStats={sections.statistics} showCurve={sections.curve} />
      )}

      {/* ── Quick Links ──────────────────────────────────── */}
      {sections.quickLinks && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { href: '/livestock/census', label: t('censusData'), desc: t('censusDataDesc'), icon: Globe, color: '#1565C0' },
            { href: '/livestock/production', label: t('production'), desc: t('productionDesc'), icon: BarChart3, color: '#2E7D32' },
            { href: '/livestock/transhumance', label: t('transhumance'), desc: t('transhumanceDesc'), icon: Route, color: '#E65100' },
            { href: '/collecte/campaigns?domain=livestock', label: t('manageCampaigns'), desc: t('manageCampaignsDesc'), icon: FileText, color: '#6A1B9A' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110" style={{ backgroundColor: `${link.color}14`, color: link.color }}>
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

      {/* ── Alert Form (form-builder) ────────────────────── */}
      {sections.alertForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('alertForms')}</h3>
          </div>
          <p className="mt-1 text-xs text-gray-400">{t('alertFormsDesc')}</p>
          <div className="mt-4 space-y-2">
            <Link
              href="/collecte/forms?domain=livestock&formType=EVENT_ALERT"
              className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Form Builder</p>
                  <p className="text-[10px] text-gray-400">Create or edit alert form templates</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300" />
            </Link>
            <Link
              href={`/collecte/forms/${LIVESTOCK_ALERT_TEMPLATE_ID}/fill?returnTo=/livestock`}
              className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('reportEvent')}</p>
                  <p className="text-[10px] text-gray-400">{t('reportEventDesc')}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── KPI Card ────────────────────────────────────────── */

function KpiCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  const formatted = typeof value === 'number' ? (value >= 1000 ? value.toLocaleString() : String(value)) : value;
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800" style={{ borderTop: `3px solid ${color}` }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{formatted}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15`, color }}>{icon}</span>
      </div>
    </div>
  );
}

/* ── Campaign Carousel ───────────────────────────────── */

const CAMPAIGN_COLORS = ['#E65100', '#1565C0', '#2E7D32', '#6A1B9A', '#C62828', '#00838F'];

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

  if (isLoading) return <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"><Skeleton className="mb-4 h-6 w-48" /><div className="flex gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-72 shrink-0 rounded-xl" />)}</div></div>;
  if (campaigns.length === 0) return <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"><h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">{t('campaignOverview')}</h3><p className="py-8 text-center text-sm text-gray-400">{t('noCampaignData')}</p></div>;

  const analyseName = (name: any) => typeof name === 'object' ? (name?.en ?? name?.fr ?? Object.values(name)[0]) : name;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('campaignOverview')}</h3>
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
          const color = CAMPAIGN_COLORS[idx % CAMPAIGN_COLORS.length];
          return (
            <Link key={c.id} href={`/collecte/campaigns/${c.id}`} className="group relative w-72 shrink-0 snap-start overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-gray-700 dark:from-gray-800 dark:to-gray-800/80">
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ backgroundColor: color }}><Activity className="h-5 w-5" /></div>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', c.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400')}>{c.status === 'ACTIVE' ? 'Active' : c.status}</span>
              </div>
              <h4 className="mt-3 text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-orange-600 dark:text-white">{analyseName(c.name)}</h4>
              <div className="mt-3 flex items-end justify-between">
                <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{(c.totalSubmissions ?? 0).toLocaleString()}</p><p className="text-[10px] text-gray-400">{c.targetSubmissions ? `/ ${c.targetSubmissions.toLocaleString()} target` : 'submissions'}</p></div>
                <div className="text-right"><p className="text-lg font-bold" style={{ color }}>{progress}%</p><p className="text-[10px] text-gray-400">complete</p></div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: color }} /></div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
