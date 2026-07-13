'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Activity,
  ClipboardCheck,
  Download,
  Upload,
  FileText,
  Globe2,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { CampaignDataDashboard } from '@/components/domain/CampaignDataDashboard';
import { useCollectionCampaigns, useDomainSubmissions } from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  aggregatePaidSubmissions,
  filterPaidSubmissions,
  type PaidFilters,
  type PaidSubmissionData,
} from '@/lib/paid';
import { PAIDKpiCards } from './components/PAIDKpiCards';
import { PAIDFilters } from './components/PAIDFilters';
import {
  PAIDProjectsPie,
  PAIDBenefByCountry,
  PAIDBenefByActivity,
  PAIDActivitiesBar,
  PAIDSectorSummary,
} from './components/PAIDCharts';

/* ================================================================== */
/*  PAID Dashboard — Main Page                                         */
/* ================================================================== */

export default function PaidPage() {
  const t = useTranslations('paid');
  const { user } = useAuthStore();

  // Filters
  const [filters, setFilters] = useState<PaidFilters>({});

  // Fetch all PAID campaigns (domain = 'paid')
  const campaignsQuery = useCollectionCampaigns({ domain: 'paid', limit: 50 });
  const rawCampaigns: any[] = Array.isArray(campaignsQuery.data?.data) ? campaignsQuery.data.data : [];
  // Sort: Q1, Q2, Q3, Q4, Annual (by code alphabetically, Q before Annual)
  const campaigns = useMemo(() => {
    return [...rawCampaigns].sort((a, b) => {
      const codeA = a.code || '';
      const codeB = b.code || '';
      const isQA = /Q\d/.test(codeA);
      const isQB = /Q\d/.test(codeB);
      if (isQA && !isQB) return -1;
      if (!isQA && isQB) return 1;
      return codeA.localeCompare(codeB);
    });
  }, [rawCampaigns]);
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE');

  // Fetch ALL submissions across ALL PAID campaigns (auto-refresh 30s)
  const subsQuery = useDomainSubmissions('paid', { refreshInterval: 30_000 });
  const rawSubmissions: any[] = Array.isArray(subsQuery.data?.data) ? subsQuery.data.data : [];

  // Apply filters and compute aggregates
  const filteredSubs = useMemo(
    () => filterPaidSubmissions(rawSubmissions, filters),
    [rawSubmissions, filters],
  );
  const agg = useMemo(
    () => aggregatePaidSubmissions(filteredSubs),
    [filteredSubs],
  );

  // Extract unique values for filter dropdowns
  const countries = useMemo(() =>
    [...new Set(rawSubmissions.map((s: any) => s.data?.adm0_name).filter(Boolean))].sort(),
    [rawSubmissions],
  );
  const projects = useMemo(() =>
    [...new Set(rawSubmissions.map((s: any) => s.data?.prj_symbol).filter(Boolean))].sort(),
    [rawSubmissions],
  );

  const isLoading = campaignsQuery.isLoading || subsQuery.isLoading;

  // Tenant level display
  const tenantLevel = user?.tenantLevel;
  const tenantLabel =
    tenantLevel === 'CONTINENTAL' ? t('continentalView')
    : tenantLevel === 'REC' ? t('recView')
    : t('countryView');

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <Globe2 className="mr-1 inline h-3 w-3" />{tenantLabel}
          </span>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PAIDFilters
          filters={filters}
          onChange={setFilters}
          countries={countries}
          projects={projects}
          t={t}
        />
        {rawSubmissions.length > 0 && (
          <span className="text-xs text-gray-400">
            {rawSubmissions.length} submissions &middot; auto-refresh 30s
          </span>
        )}
      </div>

      {/* ── KPI Cards (8 metrics like the FAO dashboard) ─ */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <PAIDKpiCards agg={agg} t={t} />
      )}

      {/* ── Campaign Carousel ──────────────────────────── */}
      <CampaignCarousel campaigns={campaigns} isLoading={campaignsQuery.isLoading} t={t} />

      {/* ── Charts Grid ────────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : rawSubmissions.length > 0 ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <PAIDProjectsPie agg={agg} t={t} />
            <PAIDBenefByActivity agg={agg} t={t} />
            <PAIDActivitiesBar agg={agg} t={t} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <PAIDBenefByCountry agg={agg} t={t} />
            <PAIDSectorSummary agg={agg} t={t} />
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <ClipboardCheck className="mx-auto h-12 w-12 text-gray-200 dark:text-gray-600" />
          <h3 className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">{t('noCampaignData')}</h3>
          <p className="mt-1 text-sm text-gray-400">
            Create a PAID campaign and start collecting activity data to see the dashboard.
          </p>
        </div>
      )}

      {/* ── CampaignDataDashboard (generic — Map + Stats + Curve) ── */}
      <CampaignDataDashboard domain="paid" showMap showStats showCurve />

      {/* ── Quick Links ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[
          { href: '/paid-collecte/by-country', label: t('byCountry'), desc: t('byCountryDesc'), icon: Globe2, color: '#1565C0' },
          { href: '/paid-collecte/by-sector', label: t('bySector'), desc: t('bySectorDesc'), icon: BarChart3, color: '#2E7D32' },
          { href: '/collecte/campaigns?domain=paid', label: t('manageCampaigns'), desc: t('manageCampaignsDesc'), icon: FileText, color: '#6A1B9A' },
          { href: '/paid-collecte/import', label: t('importExcel'), desc: t('importExcelDesc'), icon: Upload, color: '#E65100' },
          { href: '/paid-collecte/export', label: t('exportData'), desc: t('exportDataDesc'), icon: Download, color: '#37474F' },
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
              <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-white">
                {link.label}
              </span>
              <p className="mt-0.5 text-xs text-gray-400">{link.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Campaign Carousel ───────────────────────────────── */

const CAMPAIGN_COLORS = ['#1565C0', '#2E7D32', '#00838F', '#E65100', '#6A1B9A', '#C62828'];

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
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
    setTimeout(updateScrollState, 350);
  };
  const analyseName = (name: any) => typeof name === 'object' ? (name?.en ?? name?.fr ?? Object.values(name)[0]) : name;

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
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">{t('planificationOverview')}</h3>
        <p className="py-8 text-center text-sm text-gray-400">{t('noCampaignData')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('planificationOverview')}</h3>
          <p className="mt-0.5 text-xs text-gray-400">{campaigns.length} {t('totalCampaigns').toLowerCase()}</p>
        </div>
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
                <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ backgroundColor: color }}>
                  <Activity className="h-5 w-5" />
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', c.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600')}>
                  {c.status === 'ACTIVE' ? 'Active' : c.status}
                </span>
              </div>
              <h4 className="mt-3 text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-700 dark:text-white">{analyseName(c.name)}</h4>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{(c.totalSubmissions ?? 0).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">{c.targetSubmissions ? `/ ${c.targetSubmissions} target` : 'submissions'}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold" style={{ color }}>{progress}%</p>
                  <p className="text-[10px] text-gray-400">complete</p>
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: color }} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
