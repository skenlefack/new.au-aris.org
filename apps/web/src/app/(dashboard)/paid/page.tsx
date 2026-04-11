'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  MapPin,
  Users,
  Home,
  GraduationCap,
  UserCheck,
  Accessibility,
  DollarSign,
  Globe2,
  NotebookPen,
  RotateCcw,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCollectionCampaigns, useCampaignSubmissions } from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import {
  aggregatePaidSubmissions,
  filterPaidSubmissions,
  PAID_SECTORS,
  SECTOR_COLORS,
  PAID_QUARTERS,
  PAID_COUNTRIES,
  type PaidFilters,
} from '@/lib/paid';

const fmt = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

const ACT_COLORS = ['#1565C0', '#2E7D32', '#E65100', '#6A1B9A', '#00838F', '#C62828', '#4E342E', '#37474F', '#AD1457', '#33691E'];

/* ── Simple Africa map dots (lat/lng → SVG x/y) ── */
const COUNTRY_COORDS: Record<string, [number, number]> = {
  DZ: [3, 28], AO: [18, -12], BJ: [2, 9], BW: [24, -22], BF: [-1, 12], BI: [30, -3],
  CM: [12, 6], CV: [-24, 16], CF: [21, 7], TD: [19, 15], KM: [44, -12], CG: [15, -4],
  CD: [24, -3], CI: [-5, 7], DJ: [43, 12], EG: [30, 27], GQ: [10, 2], ER: [39, 15],
  SZ: [31, -26], ET: [40, 9], GA: [12, -1], GM: [-16, 13], GH: [-1, 8], GN: [-10, 11],
  GW: [-15, 12], KE: [38, 0], LS: [29, -29], LR: [-10, 6], LY: [18, 27], MG: [47, -19],
  MW: [34, -14], ML: [-4, 17], MR: [-10, 20], MU: [57, -20], MZ: [35, -18], NA: [18, -22],
  NE: [8, 17], NG: [8, 10], RW: [30, -2], ST: [7, 0], SN: [-14, 14], SC: [55, -5],
  SL: [-12, 8], SO: [46, 5], ZA: [25, -29], SS: [32, 7], SD: [30, 13], TZ: [35, -6],
  TG: [1, 8], TN: [9, 34], UG: [32, 1], ZM: [28, -15], ZW: [30, -20],
};

function lngToX(lng: number) { return ((lng + 30) / 100) * 400; }
function latToY(lat: number) { return ((40 - lat) / 80) * 400; }

export default function PaidDashboardPage() {
  const t = useTranslations('paid');
  const [filters, setFilters] = useState<PaidFilters>({});

  // Data
  const campaignsQuery = useCollectionCampaigns({ domain: 'paid', limit: 50 });
  const campaigns: any[] = Array.isArray(campaignsQuery.data?.data) ? campaignsQuery.data.data : [];
  const activeCampaignIds = campaigns.filter((c: any) => c.status === 'ACTIVE').map((c: any) => c.id);
  const subsQuery = useCampaignSubmissions(activeCampaignIds[0], { limit: 5000 });
  const rawSubmissions: any[] = Array.isArray(subsQuery.data?.data) ? subsQuery.data.data : [];

  const filtered = useMemo(() => filterPaidSubmissions(rawSubmissions, filters), [rawSubmissions, filters]);
  const agg = useMemo(() => aggregatePaidSubmissions(filtered), [filtered]);

  const countries = useMemo(() => [...new Set(rawSubmissions.map((s: any) => s.data?.adm0_name).filter(Boolean))].sort(), [rawSubmissions]);
  const projects = useMemo(() => [...new Set(rawSubmissions.map((s: any) => s.data?.prj_symbol).filter(Boolean))].sort(), [rawSubmissions]);

  const isLoading = campaignsQuery.isLoading || subsQuery.isLoading;
  const hasFilters = !!(filters.quarter || filters.country || filters.sector || filters.project);

  // Chart data
  const sectorEntries = useMemo(() => Array.from(agg.bySector.values()).sort((a, b) => b.projects.size - a.projects.size), [agg]);
  const countryEntries = useMemo(() => Array.from(agg.byCountry.values()).sort((a, b) => b.beneficiaries - a.beneficiaries).slice(0, 20), [agg]);
  const activityEntries = useMemo(() => Array.from(agg.byActivity.entries()).sort(([, a], [, b]) => b - a).slice(0, 10), [agg]);
  const totalSectorProjects = sectorEntries.reduce((s, e) => s + e.projects.size, 0) || 1;
  const maxCountryBenef = countryEntries[0]?.beneficiaries || 1;
  const totalActivityBenef = activityEntries.reduce((s, [, v]) => s + v, 0) || 1;

  // Map data
  const countryBenefMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of agg.byCountry.values()) {
      if (c.code) m.set(c.code, c.beneficiaries);
    }
    return m;
  }, [agg]);
  const maxMapBenef = Math.max(1, ...countryBenefMap.values());

  return (
    <div className="flex gap-0">
      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  LEFT SIDEBAR — Filters (like the FAO dashboard)           */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="hidden w-48 shrink-0 flex-col border-r border-gray-200 bg-gray-50 lg:flex dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Filters</p>
        </div>

        {/* Year */}
        <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
          <label className="text-[10px] font-semibold text-gray-500">Year</label>
          <select className="mt-1 w-full rounded border border-gray-200 bg-white px-2 py-1 text-[11px] dark:border-gray-600 dark:bg-gray-800" value="2026" disabled>
            <option>2026</option>
          </select>
        </div>

        {/* Quarter */}
        <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
          <label className="text-[10px] font-semibold text-gray-500">{t('filterQuarter')}</label>
          <select className="mt-1 w-full rounded border border-gray-200 bg-white px-2 py-1 text-[11px] dark:border-gray-600 dark:bg-gray-800"
            value={filters.quarter ?? ''} onChange={(e) => setFilters({ ...filters, quarter: e.target.value || undefined })}>
            <option value="">All</option>
            {PAID_QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>

        {/* Country */}
        <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
          <label className="text-[10px] font-semibold text-gray-500">{t('filterCountry')}</label>
          <select className="mt-1 w-full rounded border border-gray-200 bg-white px-2 py-1 text-[11px] dark:border-gray-600 dark:bg-gray-800"
            value={filters.country ?? ''} onChange={(e) => setFilters({ ...filters, country: e.target.value || undefined })}>
            <option value="">All</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Sector */}
        <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
          <label className="text-[10px] font-semibold text-gray-500">{t('filterSector')}</label>
          <select className="mt-1 w-full rounded border border-gray-200 bg-white px-2 py-1 text-[11px] dark:border-gray-600 dark:bg-gray-800"
            value={filters.sector ?? ''} onChange={(e) => setFilters({ ...filters, sector: e.target.value || undefined })}>
            <option value="">All</option>
            {PAID_SECTORS.map((s) => <option key={s.id} value={s.name.en}>{s.name.en}</option>)}
          </select>
        </div>

        {/* Project */}
        <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
          <label className="text-[10px] font-semibold text-gray-500">{t('filterProject')}</label>
          <select className="mt-1 w-full rounded border border-gray-200 bg-white px-2 py-1 text-[11px] dark:border-gray-600 dark:bg-gray-800"
            value={filters.project ?? ''} onChange={(e) => setFilters({ ...filters, project: e.target.value || undefined })}>
            <option value="">All</option>
            {projects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Reset filters */}
        {hasFilters && (
          <div className="px-3 py-2">
            <button onClick={() => setFilters({})} className="flex w-full items-center justify-center gap-1 rounded bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400">
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>
        )}

        {/* Data Collection link */}
        <div className="mt-auto border-t border-gray-200 px-3 py-3 dark:border-gray-700">
          <Link href="/paid-collecte" className="flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-700">
            <NotebookPen className="h-3 w-3" /> {t('paidCollecte') || 'Data Collection'}
          </Link>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  MAIN CONTENT AREA                                         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="min-w-0 flex-1">
        {/* ── HEADER ── */}
        <div className="bg-gradient-to-r from-[#003366] to-[#005599] px-5 py-3 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe2 className="h-5 w-5 text-blue-200" />
              <h1 className="text-sm font-bold tracking-tight lg:text-base">LIVESTOCK INTERVENTIONS — AU-IBAR PAID OVERVIEW</h1>
            </div>
            {hasFilters && (
              <button onClick={() => setFilters({})} className="rounded bg-white/15 px-2.5 py-1 text-[10px] font-semibold hover:bg-white/25">
                <RotateCcw className="mr-1 inline h-3 w-3" /> Click to reset filter
              </button>
            )}
          </div>
        </div>

        {/* ── 8 KPI ROW ── */}
        <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {isLoading ? (
            <div className="grid grid-cols-4 divide-x divide-gray-100 lg:grid-cols-8 dark:divide-gray-700">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)}
            </div>
          ) : (
            <div className="grid grid-cols-4 divide-x divide-gray-100 lg:grid-cols-8 dark:divide-gray-700">
              {[
                { label: 'Projects', value: agg.totalProjects, icon: FolderKanban, color: '#1565C0', sub: '' },
                { label: 'Regions', value: agg.totalRegions, icon: MapPin, color: '#00838F', sub: '' },
                { label: fmt(agg.totalBeneficiaries), value: '', icon: Users, color: '#2E7D32', sub: '# received donors', isLarge: true },
                { label: fmt(agg.totalHouseholds), value: '', icon: Home, color: '#6A1B9A', sub: 'HH', isLarge: true },
                { label: fmt(agg.totalTrained), value: '', icon: GraduationCap, color: '#E65100', sub: 'trained', isLarge: true },
                { label: fmt(agg.totalFemale), value: '', icon: UserCheck, color: '#AD1457', sub: 'female', isLarge: true },
                { label: fmt(agg.totalDisabled), value: '', icon: Accessibility, color: '#4E342E', sub: 'people w/ disability', isLarge: true },
                { label: `USD ${fmt(agg.totalQuantityImplemented)}`, value: '', icon: DollarSign, color: '#37474F', sub: 'budget delivery', isLarge: true },
              ].map((c, idx) => (
                <div key={idx} className="px-2 py-2.5 text-center">
                  {c.isLarge ? (
                    <>
                      <p className="text-base font-black text-gray-900 lg:text-lg dark:text-white" style={{ color: c.color }}>{c.label}</p>
                      <p className="text-[8px] text-gray-400">{c.sub}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-black lg:text-2xl" style={{ color: c.color }}>{c.value || c.label}</p>
                      <p className="text-[8px] text-gray-400">{c.sub || c.label}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── CHARTS GRID ── */}
        {isLoading ? (
          <div className="grid gap-3 p-3 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-lg" />)}
          </div>
        ) : (
          <>
            {/* ROW 1: 3 charts */}
            <div className="grid gap-3 p-3 lg:grid-cols-3">
              {/* % Projects by Category */}
              <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                <h4 className="mb-2 text-[11px] font-bold text-gray-600">&#9679; % Projects by Category</h4>
                <div className="space-y-1.5">
                  {sectorEntries.slice(0, 9).map((e) => {
                    const pct = Math.round((e.projects.size / totalSectorProjects) * 100);
                    const color = SECTOR_COLORS[e.sector] ?? '#9E9E9E';
                    return (
                      <div key={e.sector} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <span className="min-w-0 flex-1 truncate text-[10px] text-gray-600 dark:text-gray-400">{e.sector}</span>
                        <span className="text-[10px] font-bold text-gray-800 dark:text-gray-200">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-center text-[9px] text-gray-400">{totalSectorProjects} Total projects</p>
              </div>

              {/* Beneficiaries reached by donor / Restocking bar */}
              <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                <h4 className="mb-2 text-[11px] font-bold text-gray-600">&#9679; Livestock restocking and distribution</h4>
                <div className="space-y-1">
                  {countryEntries.slice(0, 10).map((e) => {
                    const pct = Math.round((e.beneficiaries / maxCountryBenef) * 100);
                    return (
                      <div key={e.country} className="flex items-center gap-1">
                        <span className="w-14 shrink-0 truncate text-right text-[9px] font-medium text-gray-500">{e.code || e.country.slice(0, 3)}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-700">
                          <div className="h-full rounded-sm bg-gradient-to-r from-teal-500 to-teal-700" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-10 shrink-0 text-right text-[9px] font-bold text-gray-700 dark:text-gray-300">{fmt(e.beneficiaries)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Projects that include activities */}
              <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                <h4 className="mb-2 text-[11px] font-bold text-gray-600">&#9679; Projects that include the following activities</h4>
                <div className="space-y-1">
                  {activityEntries.map(([activity, count], idx) => {
                    const maxAct = activityEntries[0]?.[1] || 1;
                    const pct = Math.round((count / maxAct) * 100);
                    return (
                      <div key={activity} className="flex items-center gap-1">
                        <span className="w-32 shrink-0 truncate text-right text-[9px] text-gray-500" title={activity}>{activity}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-700">
                          <div className="h-full rounded-sm" style={{ width: `${pct}%`, backgroundColor: ACT_COLORS[idx % ACT_COLORS.length] }} />
                        </div>
                        <span className="w-8 shrink-0 text-right text-[9px] font-bold text-gray-700 dark:text-gray-300">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ROW 2: Map + Benef by country + Benef by activity */}
            <div className="grid gap-3 px-3 pb-3 lg:grid-cols-3">
              {/* Africa Map */}
              <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                <h4 className="mb-2 text-[11px] font-bold text-gray-600">&#9679; Beneficiaries per country</h4>
                <svg viewBox="0 0 400 400" className="mx-auto w-full max-w-[280px]">
                  {/* Africa outline simplified */}
                  <path d="M150,20 Q200,10 240,30 L280,20 Q320,40 340,80 L360,120 Q370,160 360,200 L370,240 Q360,280 340,320 L300,360 Q260,390 220,380 L180,370 Q140,360 120,340 L100,300 Q80,260 60,220 L40,180 Q30,140 40,100 L60,60 Q80,30 120,20 Z" fill="#f0f4f8" stroke="#d1d5db" strokeWidth="0.5" className="dark:fill-gray-700 dark:stroke-gray-600" />
                  {/* Country dots */}
                  {Object.entries(COUNTRY_COORDS).map(([code, [lng, lat]]) => {
                    const benef = countryBenefMap.get(code) ?? 0;
                    const r = benef > 0 ? Math.max(3, Math.min(12, (benef / maxMapBenef) * 12)) : 2;
                    const opacity = benef > 0 ? 0.8 : 0.2;
                    return (
                      <circle
                        key={code}
                        cx={lngToX(lng)}
                        cy={latToY(lat)}
                        r={r}
                        fill={benef > 0 ? '#1565C0' : '#9CA3AF'}
                        opacity={opacity}
                      >
                        <title>{code}: {benef > 0 ? fmt(benef) : 'No data'}</title>
                      </circle>
                    );
                  })}
                </svg>
              </div>

              {/* Beneficiaries by country — bar */}
              <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                <h4 className="mb-2 text-[11px] font-bold text-gray-600">&#9679; Beneficiaries by country</h4>
                <div className="space-y-1">
                  {countryEntries.slice(0, 15).map((e) => {
                    const pct = Math.round((e.beneficiaries / maxCountryBenef) * 100);
                    return (
                      <div key={e.country} className="flex items-center gap-1">
                        <span className="w-16 shrink-0 truncate text-right text-[9px] font-medium text-gray-500">{e.country}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-700">
                          <div className="h-full rounded-sm bg-blue-600" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-10 shrink-0 text-right text-[9px] font-bold text-gray-700 dark:text-gray-300">{fmt(e.beneficiaries)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Beneficiaries by type of activity — pie-style */}
              <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                <h4 className="mb-2 text-[11px] font-bold text-gray-600">&#9679; Beneficiaries by type of activity</h4>
                {/* Simple pie using conic-gradient */}
                <div className="mx-auto mb-3 flex items-center justify-center">
                  <div
                    className="h-36 w-36 rounded-full"
                    style={{
                      background: activityEntries.length > 0
                        ? `conic-gradient(${activityEntries.map(([, count], idx) => {
                            const start = activityEntries.slice(0, idx).reduce((s, [, v]) => s + v, 0) / totalActivityBenef * 360;
                            const end = (activityEntries.slice(0, idx + 1).reduce((s, [, v]) => s + v, 0)) / totalActivityBenef * 360;
                            return `${ACT_COLORS[idx % ACT_COLORS.length]} ${start}deg ${end}deg`;
                          }).join(', ')})`
                        : '#e5e7eb'
                    }}
                  />
                </div>
                <div className="space-y-0.5">
                  {activityEntries.slice(0, 8).map(([activity, count], idx) => {
                    const pct = Math.round((count / totalActivityBenef) * 100);
                    return (
                      <div key={activity} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: ACT_COLORS[idx % ACT_COLORS.length] }} />
                        <span className="min-w-0 flex-1 truncate text-[9px] text-gray-500" title={activity}>{activity}</span>
                        <span className="text-[9px] font-bold text-gray-700 dark:text-gray-300">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── RED FOOTER ── */}
        <div className="bg-red-700 px-4 py-2 text-[9px] text-red-100">
          <p>
            <strong>Disclaimer:</strong> The beneficiary numbers are screen-level and the integrated data of all
            country projects are a sum that may reflect enhanced contributions to the beneficiary totals. An
            individual may receive multiple interventions and be counted multiple times.
          </p>
          <p className="mt-1">
            Data source: PAID quarterly submissions, FPMIS. Livestock interventions data cover all 55 AU member state distributions.
          </p>
        </div>
      </div>
    </div>
  );
}
