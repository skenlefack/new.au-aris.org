'use client';

import React, { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { HistoricalDataSection } from '@/components/historical/HistoricalDataSection';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileText,
  ArrowRight,
  ArrowRightLeft,
  ShieldCheck,
  Store,
  ShoppingCart,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { CampaignDataDashboard } from '@/components/domain/CampaignDataDashboard';
import { useDomainConfig } from '@/lib/hooks/use-domain-config';
import { useCollectionCampaigns } from '@/lib/api/workflow-hooks';
import { useFormSubmissions, useFormBuilderTemplates } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

const TRADE_ALERT_TEMPLATE_ID = '8b425419-5841-46fd-a71b-36e75bb47e4d';

export default function TradePage() {
  const t = useTranslations('trade');
  const { sections } = useDomainConfig('trade-sps');

  const campaignsQuery = useCollectionCampaigns({ domain: 'trade_sps', limit: 20 });
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
        {TRADE_ALERT_TEMPLATE_ID && (
          <Link
            href={`/collecte/forms/${TRADE_ALERT_TEMPLATE_ID}/fill?returnTo=/trade`}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            <Plus className="h-4 w-4" /> {t('reportIssue') || 'Report Event'}
          </Link>
        )}
      </div>

      {/* ── KPIs ─────────────────────────────────────────── */}
      {sections.kpis && (
        campaignsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard label={t('activeCampaigns') || 'Active Campaigns'} value={activeCampaigns.length} icon={<Activity className="h-5 w-5" />} color="#D84315" />
            <KpiCard label={t('totalSubmissions') || 'Total Submissions'} value={totalSubmissions} icon={<CheckCircle2 className="h-5 w-5" />} color="#2E7D32" />
            <KpiCard label={t('completionRate') || 'Completion Rate'} value={`${completionRate}%`} icon={<TrendingUp className="h-5 w-5" />} color="#1565C0" />
            <KpiCard label={t('totalCampaigns') || 'Total Campaigns'} value={campaigns.length} icon={<ShoppingCart className="h-5 w-5" />} color="#6A1B9A" />
          </div>
        )
      )}

      {/* ── Campaign Carousel ────────────────────────────── */}
      {sections.chart && <CampaignCarousel campaigns={campaigns} isLoading={campaignsQuery.isLoading} t={t} />}

      {/* ── Campaign Data Dashboard (Map + Statistics + Curve) ── */}
      {(sections.map || sections.statistics || sections.curve) && (
        <CampaignDataDashboard domain="trade_sps" showMap={sections.map} showStats={sections.statistics} showCurve={sections.curve} />
      )}

      {/* ── Quick Links ──────────────────────────────────── */}
      {sections.quickLinks && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { href: '/trade/flows', label: t('tradeFlows'), desc: t('tradeFlowsDesc'), icon: ArrowRightLeft, color: '#2E7D32' },
            { href: '/trade/sps', label: t('spsCertification'), desc: t('spsDesc'), icon: ShieldCheck, color: '#1565C0' },
            { href: '/trade/markets', label: t('markets'), desc: t('marketsDesc'), icon: Store, color: '#E65100' },
            { href: '/collecte/campaigns?domain=trade_sps', label: t('manageCampaigns') || 'Manage Campaigns', desc: t('manageCampaignsDesc') || 'Create and manage trade campaigns', icon: FileText, color: '#263238' },
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

      {/* ── Form Catalog ─────────────────────────────────── */}
      <TradeCatalog t={t} />

      {/* ── Recent Events ────────────────────────────────── */}
      {sections.alertForm && TRADE_ALERT_TEMPLATE_ID && (
        <RecentEventsCard templateId={TRADE_ALERT_TEMPLATE_ID} t={t} />
      )}

      {/* Historical Data */}
      <HistoricalDataSection domain="trade_sps" />
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

const CAMPAIGN_COLORS = ['#D84315', '#1565C0', '#2E7D32', '#E65100', '#6A1B9A', '#C62828'];

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
  if (campaigns.length === 0) return <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"><h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">{t('campaignOverview') || 'Campaign Overview'}</h3><p className="py-8 text-center text-sm text-gray-400">{t('noCampaignData') || 'No campaign data available yet'}</p></div>;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-5 flex items-center justify-between">
        <div><h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('campaignOverview') || 'Campaign Overview'}</h3><p className="mt-0.5 text-xs text-gray-400">{campaigns.length} campaigns</p></div>
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
              <h4 className="mt-3 text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-amber-700 dark:text-white">{analyseName(c.name)}</h4>
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

/* ── Trade Form Catalog ──────────────────────────────── */

function TradeCatalog({ t }: { t: (key: string) => string }) {
  const { data, isLoading } = useFormBuilderTemplates({ domain: 'trade_sps', limit: 20, status: 'PUBLISHED' });
  const allTemplates: any[] = data?.data ?? [];
  const latestByName = new Map<string, any>();
  for (const tmpl of allTemplates) {
    const existing = latestByName.get(tmpl.name);
    if (!existing || (tmpl.version ?? 0) > (existing.version ?? 0)) latestByName.set(tmpl.name, tmpl);
  }
  const templates = Array.from(latestByName.values());

  if (isLoading) return <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"><Skeleton className="mb-4 h-6 w-60" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div></div>;
  if (templates.length === 0) return null;

  const COLOR_MAP: Record<string, string> = {
    'Import and Export': '#2E7D32', 'Cost of Production': '#D84315', 'Market Price': '#E65100',
    'Market Demand': '#1565C0', 'Market Requirement and Location': '#6A1B9A',
    'Quality Standards (Inputs & Services)': '#00695C', 'Quality Standards (Poultry/Hatchery)': '#00838F',
    'Volume and Availability of Transport': '#37474F',
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 dark:border-amber-800 dark:from-amber-950/30 dark:to-gray-800">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600 text-white"><ShoppingCart className="h-5 w-5" /></div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('title')} — Data Collection Forms</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{templates.length} published templates</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {templates.map((tmpl: any) => {
          const color = COLOR_MAP[tmpl.name] ?? '#607D8B';
          return (
            <div key={tmpl.id} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
              <p className="mt-1 text-sm font-semibold text-gray-900 line-clamp-2 dark:text-white">{tmpl.name}</p>
              <div className="mt-3 flex items-center gap-2">
                <Link href={`/collecte/forms/${tmpl.id}/fill?returnTo=/trade`} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:opacity-90" style={{ backgroundColor: color }}>
                  <Plus className="h-3 w-3" /> Fill
                </Link>
              </div>
            </div>
          );
        })}
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
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Trade Events</h3>
        </div>
        <Link href={`/collecte/forms/${templateId}/fill?returnTo=/trade`} className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700"><Plus className="h-3 w-3" /> Report Event</Link>
      </div>
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : submissions.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <ShoppingCart className="h-10 w-10 text-gray-200 dark:text-gray-600" />
          <p className="mt-3 text-sm text-gray-400">No trade events reported yet</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {submissions.map((sub: any) => {
            const d = sub.data ?? {};
            const severity = SEVERITY_COLORS[d.severity] ?? SEVERITY_COLORS.low;
            const eventType = d.event_type?.replace(/_/g, ' ') ?? '';
            return (
              <div key={sub.id} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="absolute inset-x-0 top-0 h-1 bg-amber-600" />
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full', severity.dot)} />
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', severity.bg, severity.text)}>{d.severity ?? '—'}</span>
                  {eventType && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium capitalize text-gray-600 dark:bg-gray-700 dark:text-gray-400">{eventType}</span>}
                </div>
                <p className="mt-2 text-sm font-medium text-gray-900 line-clamp-2 dark:text-white">{d.description?.slice(0, 80) ?? '—'}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                  {d.date_event && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(d.date_event).toLocaleDateString()}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
