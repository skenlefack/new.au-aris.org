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
  Fish,
  Anchor,
  Ship,
  Warehouse,
  Download,
  Upload,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { CampaignDataDashboard } from '@/components/domain/CampaignDataDashboard';
import { useDomainConfig } from '@/lib/hooks/use-domain-config';
import { useCollectionCampaigns } from '@/lib/api/workflow-hooks';
import { useFormSubmissions, useFormBuilderTemplates } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

const FISHERIES_ALERT_TEMPLATE_ID = '3677c312-9b06-4391-9a05-7a3e6047d095'; // v2 (species=AQUATIC)

export default function FisheriesPage() {
  const t = useTranslations('fisheries');
  const { sections } = useDomainConfig('fisheries');

  const campaignsQuery = useCollectionCampaigns({ domain: 'fisheries', limit: 20 });
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
        <Link
          href={`/collecte/forms/${FISHERIES_ALERT_TEMPLATE_ID}/fill?returnTo=/fisheries`}
          className="flex items-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
        >
          <Plus className="h-4 w-4" /> {t('reportIssue')}
        </Link>
      </div>

      {/* ── KPIs ─────────────────────────────────────────── */}
      {sections.kpis && (
        campaignsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard label={t('activeCampaigns')} value={activeCampaigns.length} icon={<Activity className="h-5 w-5" />} color="#00838F" />
            <KpiCard label={t('totalSubmissions')} value={totalSubmissions} icon={<CheckCircle2 className="h-5 w-5" />} color="#2E7D32" />
            <KpiCard label={t('completionRate')} value={`${completionRate}%`} icon={<TrendingUp className="h-5 w-5" />} color="#1565C0" />
            <KpiCard label={t('totalCampaigns')} value={campaigns.length} icon={<Fish className="h-5 w-5" />} color="#E65100" />
          </div>
        )
      )}

      {/* ── Campaign Carousel ────────────────────────────── */}
      {sections.chart && <CampaignCarousel campaigns={campaigns} isLoading={campaignsQuery.isLoading} t={t} />}

      {/* ── Campaign Data Dashboard (Map + Statistics + Curve) ── */}
      {(sections.map || sections.statistics || sections.curve) && (
        <CampaignDataDashboard domain="fisheries" showMap={sections.map} showStats={sections.statistics} showCurve={sections.curve} />
      )}

      {/* ── Quick Links ──────────────────────────────────── */}
      {sections.quickLinks && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { href: '/fisheries/captures', label: t('captures'), desc: t('capturesDesc'), icon: Anchor, color: '#00838F' },
            { href: '/fisheries/vessels', label: t('vessels'), desc: t('vesselsDesc'), icon: Ship, color: '#1565C0' },
            { href: '/fisheries/aquaculture', label: t('aquaculture'), desc: t('aquacultureDesc'), icon: Warehouse, color: '#2E7D32' },
            { href: '/fisheries/efforts', label: t('efforts'), desc: t('effortsDesc'), icon: Activity, color: '#6A1B9A' },
            { href: '/fisheries/trade', label: t('trade'), desc: t('tradeDesc'), icon: ArrowUpDown, color: '#E65100' },
            { href: '/fisheries/export', label: t('exportData'), desc: t('exportDataDesc'), icon: Download, color: '#37474F' },
            { href: '/fisheries/import', label: t('importData'), desc: t('importDataDesc'), icon: Upload, color: '#4E342E' },
            { href: '/collecte/campaigns?domain=fisheries', label: t('manageCampaigns'), desc: t('manageCampaignsDesc'), icon: FileText, color: '#263238' },
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

      {/* ── AFADATA — Form Catalog ────────────────────────── */}
      <AfaDataCatalog t={t} />

      {/* ── Recent Events ────────────────────────────────── */}
      {sections.alertForm && <RecentEventsCard templateId={FISHERIES_ALERT_TEMPLATE_ID} t={t} />}
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

const CAMPAIGN_COLORS = ['#00838F', '#1565C0', '#2E7D32', '#E65100', '#6A1B9A', '#C62828'];

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
  const scroll = (dir: 'left' | 'right') => { scrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' }); setTimeout(updateScrollState, 350); };
  const analyseName = (name: any) => typeof name === 'object' ? (name?.en ?? name?.fr ?? Object.values(name)[0]) : name;

  if (isLoading) return <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"><Skeleton className="mb-4 h-6 w-48" /><div className="flex gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-72 shrink-0 rounded-xl" />)}</div></div>;
  if (campaigns.length === 0) return <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"><h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">{t('campaignOverview')}</h3><p className="py-8 text-center text-sm text-gray-400">{t('noCampaignData')}</p></div>;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-5 flex items-center justify-between">
        <div><h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('campaignOverview')}</h3><p className="mt-0.5 text-xs text-gray-400">{campaigns.length} {t('activeCampaigns').toLowerCase()}</p></div>
        <div className="flex items-center gap-1">
          <button onClick={() => scroll('left')} disabled={!canScrollLeft} className="rounded-full border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:border-gray-700"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => scroll('right')} disabled={!canScrollRight} className="rounded-full border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:border-gray-700"><ChevronRight className="h-4 w-4" /></button>
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
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', c.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600')}>{c.status === 'ACTIVE' ? 'Active' : c.status}</span>
              </div>
              <h4 className="mt-3 text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-cyan-700 dark:text-white">{analyseName(c.name)}</h4>
              <div className="mt-3 flex items-end justify-between">
                <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{(c.totalSubmissions ?? 0).toLocaleString()}</p><p className="text-[10px] text-gray-400">{c.targetSubmissions ? `/ ${c.targetSubmissions} target` : 'submissions'}</p></div>
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

/* ── AFADATA — Form Catalog ─────────────────────────── */

const AFADATA_FORM_MAP: Record<string, { href: string; color: string }> = {
  'Monthly Captures Report': { href: '/fisheries/captures', color: '#00838F' },
  'Capture Fisheries Report': { href: '/fisheries/captures', color: '#00838F' },
  'Vessel Registry': { href: '/fisheries/vessels', color: '#1565C0' },
  'Fishing Vessel Registration': { href: '/fisheries/vessels', color: '#1565C0' },
  'Aquaculture Farm Report': { href: '/fisheries/aquaculture', color: '#2E7D32' },
  'Aquaculture Farm Registration': { href: '/fisheries/aquaculture', color: '#2E7D32' },
  'Aquaculture Production Report': { href: '/fisheries/aquaculture', color: '#2E7D32' },
  'Fishing Effort Quarterly': { href: '/fisheries/efforts', color: '#6A1B9A' },
  'Fishing Effort Report': { href: '/fisheries/efforts', color: '#6A1B9A' },
  'Fish Trade Report': { href: '/fisheries/trade', color: '#E65100' },
  'Fisheries & Aquaculture Event Alert': { href: '/fisheries', color: '#C62828' },
};

function AfaDataCatalog({ t }: { t: (key: string) => string }) {
  const { data, isLoading } = useFormBuilderTemplates({ domain: 'fisheries', limit: 20, status: 'PUBLISHED' });
  const templates: any[] = data?.data ?? [];

  if (isLoading) return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <Skeleton className="mb-4 h-6 w-60" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    </div>
  );

  if (templates.length === 0) return null;

  return (
    <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-6 dark:border-teal-800 dark:from-teal-950/30 dark:to-gray-800">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white">
          <Fish className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">AFADATA — {t('title')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {templates.length} {t('activeCampaigns').toLowerCase()} &bull; AU-IBAR Continental Data Collection
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tmpl: any) => {
          const mapped = AFADATA_FORM_MAP[tmpl.name] ?? { href: '/fisheries', color: '#607D8B' };
          const formType = tmpl.formType === 'EVENT_ALERT' ? 'Event Alert' : 'Campaign';
          return (
            <div key={tmpl.id} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: mapped.color }} />
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                  {formType}
                </span>
                <span className="text-[10px] text-gray-400">v{tmpl.version}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-gray-900 line-clamp-2 dark:text-white">{tmpl.name}</p>
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href={`/collecte/forms/${tmpl.id}/fill?returnTo=/fisheries`}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: mapped.color }}
                >
                  <Plus className="h-3 w-3" /> Fill
                </Link>
                <Link
                  href={mapped.href}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  <ArrowRight className="h-3 w-3" /> View data
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-teal-100 pt-4 dark:border-teal-800">
        <Link href="/fisheries/export" className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
          <Download className="h-3.5 w-3.5" /> {t('exportData')}
        </Link>
        <Link href="/fisheries/import" className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
          <Upload className="h-3.5 w-3.5" /> {t('importData')}
        </Link>
        <Link href="/collecte/campaigns?domain=fisheries" className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
          <FileText className="h-3.5 w-3.5" /> {t('manageCampaigns')}
        </Link>
        <Link href="/collecte/forms?domain=fisheries" className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
          <ExternalLink className="h-3.5 w-3.5" /> All forms
        </Link>
      </div>
    </div>
  );
}

/* ── Recent Events Card ──────────────────────────────── */

const SEVERITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  low: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
  medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' },
  high: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
};

function RecentEventsCard({ templateId, t }: { templateId: string; t: (key: string) => string }) {
  const { data, isLoading } = useFormSubmissions(templateId, { page: 1, limit: 6, status: 'SUBMITTED' });
  const submissions: any[] = data?.data ?? [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-cyan-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('recentEvents')}</h3>
        </div>
        <Link href={`/collecte/forms/${templateId}/fill?returnTo=/fisheries`} className="flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700"><Plus className="h-3 w-3" /> {t('reportIssue')}</Link>
      </div>
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : submissions.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Fish className="h-10 w-10 text-gray-200 dark:text-gray-600" />
          <p className="mt-3 text-sm text-gray-400">{t('noRecentEvents')}</p>
          <Link href={`/collecte/forms/${templateId}/fill?returnTo=/fisheries`} className="mt-3 flex items-center gap-1 text-sm font-medium text-cyan-600 hover:text-cyan-700"><Plus className="h-4 w-4" /> {t('reportIssue')}</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {submissions.map((sub: any) => {
            const d = sub.data ?? {};
            const severity = SEVERITY_COLORS[d.severity] ?? SEVERITY_COLORS.low;
            const eventType = d.event_type?.replace(/_/g, ' ') ?? '';
            return (
              <div key={sub.id} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="absolute inset-x-0 top-0 h-1 bg-cyan-600" />
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full', severity.dot)} />
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', severity.bg, severity.text)}>{d.severity ?? '—'}</span>
                  {eventType && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium capitalize text-gray-600 dark:bg-gray-700 dark:text-gray-400">{eventType}</span>}
                </div>
                <p className="mt-2 text-sm font-medium text-gray-900 line-clamp-2 dark:text-white">{d.description?.slice(0, 80) ?? '—'}{(d.description?.length ?? 0) > 80 ? '...' : ''}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                  {d.date_event && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(d.date_event).toLocaleDateString()}</span>}
                  {(d.vessels_involved ?? 0) > 0 && <span>{d.vessels_involved} vessels</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
