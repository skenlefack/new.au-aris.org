'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Globe2,
  FolderKanban,
  MapPin,
  Building2,
  FileCheck2,
  TrendingUp,
  Target,
  Percent,
  DollarSign,
  RotateCcw,
  NotebookPen,
  BarChart3,
  Upload,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDomainSubmissions } from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import {
  aggregatePaidSubmissions,
  filterPaidSubmissions,
  extractPaidFilterOptions,
  PAID_SECTORS,
  SECTOR_COLORS,
  PAID_QUARTERS,
  type PaidFilters,
} from '@/lib/paid';
import type { CountryOutbreakData } from '@/components/dashboard/demo-data';

/* Leaflet map — dynamic import (no SSR) */
const ChoroplethMap = dynamic(
  () => import('@/components/dashboard/maps/ChoroplethMap').then((m) => m.ChoroplethMap),
  { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-xl" /> },
);

/* ── Helpers ── */
const fmt = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

const PIE_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#92400e', '#475569', '#be185d', '#4d7c0f', '#0369a1', '#65a30d'];

function conicGradient(entries: [string, number][], colors: string[]): string {
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  let acc = 0;
  const stops = entries.map(([, v], i) => {
    const start = (acc / total) * 360;
    acc += v;
    const end = (acc / total) * 360;
    return `${colors[i % colors.length]} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

/* ── KPI icon map ── */
const KPI_CONFIG = [
  { key: 'projects', icon: FolderKanban, color: '#2563eb', bg: '#eff6ff' },
  { key: 'countries', icon: MapPin, color: '#059669', bg: '#ecfdf5' },
  { key: 'recs', icon: Building2, color: '#7c3aed', bg: '#f5f3ff' },
  { key: 'submissions', icon: FileCheck2, color: '#0891b2', bg: '#ecfeff' },
  { key: 'qtyImpl', icon: TrendingUp, color: '#d97706', bg: '#fffbeb' },
  { key: 'qtyTarget', icon: Target, color: '#dc2626', bg: '#fef2f2' },
  { key: 'completion', icon: Percent, color: '#059669', bg: '#ecfdf5' },
  { key: 'expenditure', icon: DollarSign, color: '#92400e', bg: '#fffbeb' },
] as const;

/* ================================================================== */
/*  PAID Dashboard — FAO-style Professional Layout                     */
/* ================================================================== */

export default function PaidDashboardPage() {
  const t = useTranslations('paid');
  const [filters, setFilters] = useState<PaidFilters>({});
  const [mapCountry, setMapCountry] = useState<string | undefined>();

  // Data — fetch ALL submissions across ALL PAID campaigns (auto-refresh 30s)
  const subsQ = useDomainSubmissions('paid', { refreshInterval: 30_000 });
  const rawSubs: any[] = Array.isArray(subsQ.data?.data) ? subsQ.data.data : [];

  const filtered = useMemo(() => filterPaidSubmissions(rawSubs, filters), [rawSubs, filters]);
  const agg = useMemo(() => aggregatePaidSubmissions(filtered), [filtered]);

  const filterOpts = useMemo(() => extractPaidFilterOptions(rawSubs), [rawSubs]);

  const loading = subsQ.isLoading;
  const hasF = !!(filters.quarter || filters.country || filters.sector || filters.project);

  // Chart data
  const countryArr = useMemo(() => Array.from(agg.byCountry.values()).sort((a, b) => b.quantityImplemented - a.quantityImplemented), [agg]);
  const activityArr = useMemo(() =>
    Array.from(agg.byActivity.values()).sort((a, b) => b.quantityImplemented - a.quantityImplemented).slice(0, 10),
  [agg]);
  const projectArr = useMemo(() => Array.from(agg.byProject.values()).sort((a, b) => b.quantityImplemented - a.quantityImplemented), [agg]);
  const quarterArr = useMemo(() => Array.from(agg.byQuarter.values()).sort((a, b) => a.quarter.localeCompare(b.quarter)), [agg]);

  // Map data
  const mapData: CountryOutbreakData[] = useMemo(() =>
    Array.from(agg.byCountry.values()).map((c) => ({
      code: c.code,
      name: c.country,
      outbreaks: c.submissions,
      cases: c.quantityImplemented,
      deaths: c.quantityTargeted,
      vaccinations: c.projects.size,
      submissions: c.submissions,
      rec: '',
    })),
  [agg]);

  const kpiValues = [
    { val: String(agg.totalProjects), label: 'Projects' },
    { val: String(agg.totalCountries), label: 'Countries' },
    { val: String(agg.totalRecs), label: 'RECs' },
    { val: String(agg.totalSubmissions), label: 'Submissions' },
    { val: fmt(agg.totalQuantityImplemented), label: 'Qty Implemented' },
    { val: fmt(agg.totalQuantityTargeted), label: 'Qty Targeted' },
    { val: `${agg.completionRate}%`, label: 'Completion' },
    { val: `$${fmt(agg.totalExpenditure)}`, label: 'Expenditure' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      {/* ═══════════ HEADER BAR ═══════════ */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-md shadow-emerald-500/20">
              <Globe2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 dark:text-white">AU-IBAR PAID Dashboard</h1>
              <p className="text-[10px] text-gray-500">Programme Activity Information Database &middot; LICS Projects</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!loading && rawSubs.length > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                {rawSubs.length} submissions &middot; Live
              </span>
            )}
            <Link href="/paid-collecte" className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-emerald-700">
              <NotebookPen className="h-3 w-3" /> Data Collection
            </Link>
          </div>
        </div>

        {/* ── Filters Row ── */}
        <div className="flex items-center gap-2 border-t border-gray-100 px-6 py-2 dark:border-gray-800">
          <FilterPill label="Quarter" value={filters.quarter} options={[...PAID_QUARTERS]}
            onChange={(v) => setFilters({ ...filters, quarter: v || undefined })} />
          <FilterPill label="Country" value={filters.country} options={filterOpts.countries}
            onChange={(v) => setFilters({ ...filters, country: v || undefined })} />
          <FilterPill label="Project" value={filters.project} options={filterOpts.projects}
            onChange={(v) => setFilters({ ...filters, project: v || undefined })} />
          {hasF && (
            <button onClick={() => setFilters({})} className="flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-600 transition hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400">
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
          <div className="flex-1" />
          <Link href="/paid-collecte/by-country" className="text-[10px] font-medium text-blue-600 hover:underline">By Country</Link>
          <Link href="/paid-collecte/by-sector" className="text-[10px] font-medium text-blue-600 hover:underline">By Sector</Link>
          <Link href="/paid-collecte/import" className="text-[10px] font-medium text-blue-600 hover:underline">Import</Link>
        </div>
      </div>

      {/* ═══════════ KPI CARDS ROW ═══════════ */}
      <div className="px-6 pt-5 pb-2">
        <div className="grid grid-cols-4 gap-3 lg:grid-cols-8">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)
          ) : (
            kpiValues.map((kpi, i) => {
              const cfg = KPI_CONFIG[i];
              const Icon = cfg.icon;
              return (
                <div key={cfg.key} className="group relative overflow-hidden rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
                  <div className="absolute -right-2 -top-2 h-12 w-12 rounded-full opacity-[0.07]" style={{ backgroundColor: cfg.color }} />
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[22px] font-extrabold leading-tight" style={{ color: cfg.color }}>{kpi.val}</p>
                      <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-gray-400">{kpi.label}</p>
                    </div>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: cfg.bg }}>
                      <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══════════ MAIN CONTENT GRID ═══════════ */}
      {loading ? (
        <div className="grid gap-4 px-6 py-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[300px] rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-4 px-6 py-4">
          {/* ── ROW 1: Map + Country bars + Project donut ── */}
          <div className="grid gap-4 lg:grid-cols-12">
            {/* MAP — 6 cols */}
            <div className="lg:col-span-6 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
                <h3 className="text-xs font-bold text-gray-900 dark:text-white">Activity Coverage Map</h3>
                <span className="text-[9px] text-gray-400">{agg.totalCountries} countries with data</span>
              </div>
              <div className="relative h-[380px]">
                <ChoroplethMap
                  title=""
                  data={mapData}
                  indicator="submissions"
                  height="380px"
                  bare
                  selectedCountry={mapCountry}
                  onCountryClick={(code) => setMapCountry(mapCountry === code ? undefined : code)}
                />
              </div>
            </div>

            {/* COUNTRY BARS — 3 cols */}
            <Card title="Quantity by Country" className="lg:col-span-3">
              <div className="space-y-1.5">
                {countryArr.slice(0, 10).map((e, idx) => {
                  const max = countryArr[0]?.quantityImplemented || 1;
                  const pct = Math.round((e.quantityImplemented / max) * 100);
                  return (
                    <div key={e.country} className="group flex items-center gap-2">
                      <span className="w-[52px] shrink-0 truncate text-right text-[10px] font-medium text-gray-600 dark:text-gray-400">{e.country}</span>
                      <div className="h-[16px] flex-1 overflow-hidden rounded bg-gray-50 dark:bg-gray-800">
                        <div className="h-full rounded transition-all duration-500" style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${PIE_COLORS[idx % PIE_COLORS.length]}cc, ${PIE_COLORS[idx % PIE_COLORS.length]})`,
                        }} />
                      </div>
                      <span className="w-[32px] shrink-0 text-right text-[10px] font-bold text-gray-700 dark:text-gray-300">{fmt(e.quantityImplemented)}</span>
                    </div>
                  );
                })}
                {countryArr.length === 0 && <EmptyState />}
              </div>
            </Card>

            {/* PROJECT DONUT — 3 cols */}
            <Card title="Implementation by Project" className="lg:col-span-3">
              {projectArr.length > 0 ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative h-[140px] w-[140px]">
                    <div className="h-full w-full rounded-full shadow-inner" style={{
                      background: conicGradient(projectArr.map((e) => [e.symbol, e.quantityImplemented]), PIE_COLORS),
                    }} />
                    <div className="absolute inset-[28px] flex items-center justify-center rounded-full bg-white text-center dark:bg-gray-900">
                      <div>
                        <p className="text-lg font-extrabold text-gray-900 dark:text-white">{agg.totalProjects}</p>
                        <p className="text-[8px] uppercase tracking-wider text-gray-400">projects</p>
                      </div>
                    </div>
                  </div>
                  <div className="w-full space-y-1">
                    {projectArr.map((e, i) => (
                      <div key={e.symbol} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">{e.symbol}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-900 dark:text-white">{fmt(e.quantityImplemented)}</span>
                          <span className="text-[9px] text-gray-400">{e.countries.size} ctry</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <EmptyState />}
            </Card>
          </div>

          {/* ── ROW 2: Activities bar + Quarter trend + Submissions pie ── */}
          <div className="grid gap-4 lg:grid-cols-12">
            {/* ACTIVITIES — 5 cols */}
            <Card title="Top Activities" className="lg:col-span-5">
              <div className="space-y-2">
                {activityArr.map((act, idx) => {
                  const max = activityArr[0]?.quantityImplemented || 1;
                  const pct = Math.round((act.quantityImplemented / max) * 100);
                  const color = PIE_COLORS[idx % PIE_COLORS.length];
                  return (
                    <div key={act.label}>
                      <div className="mb-0.5 flex items-center justify-between">
                        <span className="max-w-[70%] truncate text-[10px] font-medium text-gray-700 dark:text-gray-300" title={act.label}>{act.label}</span>
                        <span className="text-[10px] font-bold text-gray-900 dark:text-white">{fmt(act.quantityImplemented)} <span className="font-normal text-gray-400">({act.submissions})</span></span>
                      </div>
                      <div className="h-[6px] w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
                {activityArr.length === 0 && <EmptyState />}
              </div>
            </Card>

            {/* QUARTER TREND — 4 cols */}
            <Card title="Quarterly Progress" className="lg:col-span-4">
              {quarterArr.length > 0 ? (
                <div className="space-y-3">
                  {quarterArr.map((q) => {
                    const maxQ = Math.max(...quarterArr.map(qq => qq.quantityImplemented)) || 1;
                    const pct = Math.round((q.quantityImplemented / maxQ) * 100);
                    return (
                      <div key={q.quarter} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900 dark:text-white">{q.quarter}</span>
                          <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{q.submissions} subs</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-[8px] flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-700" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="shrink-0 text-[11px] font-bold text-gray-900 dark:text-white">{fmt(q.quantityImplemented)}</span>
                        </div>
                        {q.expenditure > 0 && (
                          <p className="mt-1 text-[9px] text-gray-400">${q.expenditure.toLocaleString()} expenditure</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState />}
            </Card>

            {/* SUBMISSIONS BY COUNTRY — 3 cols */}
            <Card title="Submissions per Country" className="lg:col-span-3">
              <div className="space-y-1">
                {countryArr.slice(0, 10).map((e) => {
                  const maxS = countryArr[0]?.submissions || 1;
                  const pct = Math.round((e.submissions / maxS) * 100);
                  return (
                    <div key={e.country} className="flex items-center gap-2 rounded-md px-1 py-0.5 transition hover:bg-gray-50 dark:hover:bg-gray-800">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <span className="flex-1 truncate text-[10px] font-medium text-gray-700 dark:text-gray-300">{e.country}</span>
                      <div className="w-14 h-[5px] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-5 text-right text-[10px] font-bold text-gray-900 dark:text-white">{e.submissions}</span>
                    </div>
                  );
                })}
                {countryArr.length === 0 && <EmptyState />}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════════ DISCLAIMER FOOTER ═══════════ */}
      <div className="mx-6 mb-6 rounded-lg bg-gray-900 px-4 py-2.5 text-[10px] leading-relaxed text-gray-400 dark:bg-gray-800">
        <strong className="text-gray-300">Disclaimer:</strong> The data presented reflects quarterly PAID submissions from LICS projects across AU Member States.
        Quantities represent aggregated activity outputs. Data source: PAID quarterly submissions via ARIS 4.0 &middot; Auto-refreshed every 30s.
      </div>
    </div>
  );
}

/* ═══════════ Reusable Components ═══════════ */

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      <div className="border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
        <h3 className="text-xs font-bold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function FilterPill({ label, value, options, onChange }: {
  label: string; value?: string; options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-md border py-1 pl-2.5 pr-6 text-[10px] font-medium transition
          ${value
            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
          }`}
      >
        <option value="">{label}: All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <BarChart3 className="h-8 w-8 text-gray-200 dark:text-gray-700" />
      <p className="mt-2 text-xs text-gray-400">No data available</p>
    </div>
  );
}
