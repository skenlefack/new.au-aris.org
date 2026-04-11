'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Globe2, NotebookPen, RotateCcw } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCollectionCampaigns, useCampaignSubmissions } from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import {
  aggregatePaidSubmissions,
  filterPaidSubmissions,
  PAID_SECTORS,
  SECTOR_COLORS,
  PAID_QUARTERS,
  type PaidFilters,
} from '@/lib/paid';
import type { CountryOutbreakData } from '@/components/dashboard/demo-data';

/* Leaflet map — dynamic import (no SSR) */
const ChoroplethMap = dynamic(
  () => import('@/components/dashboard/maps/ChoroplethMap').then((m) => m.ChoroplethMap),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);

/* ── Helpers ── */
const fmt = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

const PIE_COLORS = ['#1565C0', '#2E7D32', '#E65100', '#6A1B9A', '#00838F', '#C62828', '#4E342E', '#37474F', '#AD1457', '#33691E', '#0277BD', '#558B2F'];

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

/* ================================================================== */
/*  PAID Dashboard                                                     */
/* ================================================================== */

export default function PaidDashboardPage() {
  const t = useTranslations('paid');
  const [filters, setFilters] = useState<PaidFilters>({});

  // Data
  const cQ = useCollectionCampaigns({ domain: 'paid', limit: 50 });
  const campaigns: any[] = Array.isArray(cQ.data?.data) ? cQ.data.data : [];
  const firstActive = campaigns.find((c: any) => c.status === 'ACTIVE');
  const sQ = useCampaignSubmissions(firstActive?.id, { limit: 5000 });
  const rawSubs: any[] = Array.isArray(sQ.data?.data) ? sQ.data.data : [];

  const filtered = useMemo(() => filterPaidSubmissions(rawSubs, filters), [rawSubs, filters]);
  const agg = useMemo(() => aggregatePaidSubmissions(filtered), [filtered]);

  const countries = useMemo(() => [...new Set(rawSubs.map((s: any) => s.data?.adm0_name).filter(Boolean))].sort(), [rawSubs]);
  const projects = useMemo(() => [...new Set(rawSubs.map((s: any) => s.data?.prj_symbol).filter(Boolean))].sort(), [rawSubs]);

  const loading = cQ.isLoading || sQ.isLoading;
  const hasF = !!(filters.quarter || filters.country || filters.sector || filters.project);

  // Chart data
  const sectorArr = useMemo(() => Array.from(agg.bySector.values()).sort((a, b) => b.projects.size - a.projects.size), [agg]);
  const countryArr = useMemo(() => Array.from(agg.byCountry.values()).sort((a, b) => b.beneficiaries - a.beneficiaries), [agg]);
  const activityArr = useMemo(() => Array.from(agg.byActivity.entries()).sort(([, a], [, b]) => b - a).slice(0, 12), [agg]);
  const projectArr = useMemo(() => Array.from(agg.byProject.values()).sort((a, b) => b.beneficiaries - a.beneficiaries), [agg]);
  const totalSP = sectorArr.reduce((s, e) => s + e.projects.size, 0) || 1;
  const maxCB = countryArr[0]?.beneficiaries || 1;
  const totalAB = activityArr.reduce((s, [, v]) => s + v, 0) || 1;

  // Map data — convert PAID aggregates to CountryOutbreakData for ChoroplethMap
  const mapData: CountryOutbreakData[] = useMemo(() =>
    Array.from(agg.byCountry.values()).map((c) => ({
      code: c.code,
      name: c.country,
      outbreaks: c.projects.size,        // use projects as "outbreaks" for color scale
      cases: c.beneficiaries,
      deaths: 0,
      vaccinations: c.trained,
      submissions: c.submissions,
      rec: '',
    })),
  [agg]);

  return (
    <div className="flex min-h-[calc(100vh-56px)] bg-[#f0f2f5] dark:bg-gray-950">
      {/* ══════════ LEFT SIDEBAR ══════════ */}
      <aside className="hidden w-[150px] shrink-0 flex-col border-r border-gray-300 bg-white lg:flex dark:border-gray-700 dark:bg-gray-900">
        <div className="bg-[#003366] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-white">
          Filters
        </div>

        <SideFilter label="Year" value="2026" options={['2026']} disabled />
        <SideFilter label={t('filterQuarter')} value={filters.quarter}
          options={[...PAID_QUARTERS]} onChange={(v) => setFilters({ ...filters, quarter: v || undefined })} />
        <SideFilter label="Regions" value="" options={[]} disabled />
        <SideFilter label={t('filterCountry')} value={filters.country}
          options={countries} onChange={(v) => setFilters({ ...filters, country: v || undefined })} />
        <SideFilter label={t('filterSector')} value={filters.sector}
          options={PAID_SECTORS.map((s) => s.name.en)} onChange={(v) => setFilters({ ...filters, sector: v || undefined })} />
        <SideFilter label="Donor" value="" options={[]} disabled />
        <SideFilter label={t('filterProject')} value={filters.project}
          options={projects} onChange={(v) => setFilters({ ...filters, project: v || undefined })} />

        {hasF && (
          <div className="px-2 py-1.5">
            <button onClick={() => setFilters({})} className="flex w-full items-center justify-center gap-1 rounded bg-red-50 py-1 text-[8px] font-bold text-red-600 hover:bg-red-100">
              <RotateCcw className="h-2.5 w-2.5" /> Reset
            </button>
          </div>
        )}

        <div className="mt-auto border-t border-gray-200 px-2 py-2 dark:border-gray-700">
          <Link href="/paid-collecte" className="flex items-center gap-1 rounded bg-[#003366] px-2 py-1 text-[8px] font-bold text-white hover:bg-[#004488]">
            <NotebookPen className="h-2.5 w-2.5" /> Collecte PAID
          </Link>
        </div>
      </aside>

      {/* ══════════ MAIN ══════════ */}
      <main className="min-w-0 flex-1 flex flex-col">
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between bg-[#003366] px-4 py-[6px]">
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-white/60" />
            <span className="text-[11px] font-bold tracking-wide text-white lg:text-xs">LIVESTOCK INTERVENTIONS* — AU-IBAR PAID OVERVIEW</span>
          </div>
          {hasF && (
            <button onClick={() => setFilters({})} className="rounded bg-white/20 px-2 py-0.5 text-[8px] font-bold text-white hover:bg-white/30">
              Click to reset filter
            </button>
          )}
        </div>

        {/* ── 8 KPI ROW ── */}
        <div className="grid grid-cols-4 divide-x divide-gray-200 border-b border-gray-300 bg-white lg:grid-cols-8 dark:divide-gray-700 dark:bg-gray-900">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[52px]" />)
          ) : (
            [
              { val: String(agg.totalProjects), sub: 'Projects' },
              { val: String(agg.totalRegions), sub: 'Regions' },
              { val: fmt(agg.totalBeneficiaries), sub: '# received donors' },
              { val: fmt(agg.totalHouseholds), sub: 'HH' },
              { val: fmt(agg.totalTrained), sub: 'trained' },
              { val: fmt(agg.totalFemale), sub: 'female' },
              { val: fmt(agg.totalDisabled), sub: 'people w/ disability' },
              { val: `USD ${fmt(agg.totalQuantityImplemented)}`, sub: 'beneficiaries' },
            ].map((k, i) => (
              <div key={i} className="px-1 py-1.5 text-center">
                <p className="text-[13px] font-black text-[#003366] lg:text-[15px] dark:text-blue-300">{k.val}</p>
                <p className="text-[7px] text-gray-400 leading-tight">{k.sub}</p>
              </div>
            ))
          )}
        </div>

        {/* ── CONTENT ── */}
        {loading ? (
          <div className="grid flex-1 gap-[1px] bg-gray-300 p-0 lg:grid-cols-4 lg:grid-rows-2">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="min-h-[180px] bg-white" />)}
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {/* ROW 1 — 4 panels */}
            <div className="grid grid-cols-2 gap-[1px] bg-gray-300 lg:grid-cols-4 dark:bg-gray-700">
              {/* 1: % Projects by Category — PIE */}
              <Panel title="% Projects by Category">
                <div className="flex items-start gap-2">
                  <div className="h-[90px] w-[90px] shrink-0 rounded-full shadow-inner" style={{
                    background: sectorArr.length > 0
                      ? conicGradient(sectorArr.map((e) => [e.sector, e.projects.size]), sectorArr.map((e) => SECTOR_COLORS[e.sector] ?? '#9E9E9E'))
                      : '#e5e7eb'
                  }} />
                  <div className="min-w-0 space-y-[2px] pt-0.5">
                    {sectorArr.slice(0, 7).map((e) => (
                      <div key={e.sector} className="flex items-center gap-1">
                        <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ backgroundColor: SECTOR_COLORS[e.sector] ?? '#9E9E9E' }} />
                        <span className="truncate text-[7px] leading-tight text-gray-500">{e.sector}</span>
                      </div>
                    ))}
                    <p className="pt-0.5 text-[7px] text-gray-400">{totalSP} Total projects</p>
                  </div>
                </div>
              </Panel>

              {/* 2: Beneficiaries reached by donor — DONUT */}
              <Panel title="Beneficiaries reached by donor">
                <div className="flex items-start gap-2">
                  <div className="relative h-[90px] w-[90px] shrink-0 rounded-full shadow-inner" style={{
                    background: projectArr.length > 0
                      ? conicGradient(projectArr.map((e) => [e.symbol, e.beneficiaries]), PIE_COLORS)
                      : '#e5e7eb'
                  }}>
                    <div className="absolute inset-[14px] rounded-full bg-white dark:bg-gray-800" />
                  </div>
                  <div className="min-w-0 space-y-[2px] pt-0.5">
                    {projectArr.slice(0, 6).map((e, i) => (
                      <div key={e.symbol} className="flex items-center gap-1">
                        <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="truncate text-[7px] leading-tight text-gray-500">{e.symbol.split('/').pop()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              {/* 3: Livestock restocking — BARS */}
              <Panel title="Livestock restocking and distribution">
                <div className="space-y-[2px]">
                  {countryArr.slice(0, 12).map((e) => {
                    const pct = Math.round((e.beneficiaries / maxCB) * 100);
                    return (
                      <div key={e.country} className="flex items-center gap-[3px]">
                        <span className="w-[30px] shrink-0 text-right text-[7px] font-medium text-gray-500">{e.code || e.country.slice(0, 3)}</span>
                        <div className="h-[8px] flex-1 overflow-hidden rounded-[2px] bg-gray-100 dark:bg-gray-700">
                          <div className="h-full rounded-[2px] bg-teal-600" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              {/* 4: Activities included — BARS */}
              <Panel title="Projects that include the following activities">
                <div className="space-y-[2px]">
                  {activityArr.slice(0, 12).map(([act, count], idx) => {
                    const max = activityArr[0]?.[1] || 1;
                    const pct = Math.round((count / max) * 100);
                    return (
                      <div key={act} className="flex items-center gap-[3px]">
                        <span className="w-[70px] shrink-0 truncate text-right text-[6px] text-gray-500" title={act}>{act}</span>
                        <div className="h-[8px] flex-1 overflow-hidden rounded-[2px] bg-gray-100 dark:bg-gray-700">
                          <div className="h-full rounded-[2px]" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        </div>
                        <span className="w-[14px] text-right text-[6px] font-bold text-gray-600">{count}</span>
                      </div>
                    );
                  })}
                  <p className="text-right text-[6px] text-gray-400">{activityArr.reduce((s, [, v]) => s + v, 0)} Total projects</p>
                </div>
              </Panel>
            </div>

            {/* ROW 2 — 3 panels */}
            <div className="grid grid-cols-1 gap-[1px] bg-gray-300 lg:grid-cols-3 dark:bg-gray-700">
              {/* 5: Africa MAP — Leaflet */}
              <Panel title="Beneficiaries per country" noPad>
                <div className="h-[220px] w-full">
                  <ChoroplethMap
                    title=""
                    data={mapData}
                    indicator="outbreaks"
                    height="220px"
                    bare
                  />
                </div>
              </Panel>

              {/* 6: Beneficiaries by country — BAR */}
              <Panel title="Beneficiaries by country">
                <div className="space-y-[2px]">
                  {countryArr.slice(0, 18).map((e) => {
                    const pct = Math.round((e.beneficiaries / maxCB) * 100);
                    return (
                      <div key={e.country} className="flex items-center gap-[3px]">
                        <span className="w-[42px] shrink-0 truncate text-right text-[7px] font-medium text-gray-500">{e.country}</span>
                        <div className="h-[8px] flex-1 overflow-hidden rounded-[2px] bg-gray-100 dark:bg-gray-700">
                          <div className="h-full rounded-[2px] bg-[#1565C0]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-[24px] text-right text-[7px] font-bold text-gray-600 dark:text-gray-300">{fmt(e.beneficiaries)}</span>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              {/* 7: Beneficiaries by type of activity — PIE */}
              <Panel title="Beneficiaries by type of activity">
                <div className="flex items-start gap-2">
                  <div className="h-[100px] w-[100px] shrink-0 rounded-full shadow-inner" style={{
                    background: activityArr.length > 0
                      ? conicGradient(activityArr, PIE_COLORS)
                      : '#e5e7eb'
                  }} />
                  <div className="min-w-0 space-y-[2px] pt-0.5">
                    {activityArr.slice(0, 10).map(([act], idx) => (
                      <div key={act} className="flex items-center gap-1">
                        <span className="h-[6px] w-[6px] shrink-0 rounded-[1px]" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        <span className="truncate text-[6px] leading-tight text-gray-500" title={act}>{act}</span>
                      </div>
                    ))}
                    <p className="pt-0.5 text-[6px] italic text-gray-400">% annual target by species-level interventions</p>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        )}

        {/* ── RED FOOTER ── */}
        <div className="bg-[#c0392b] px-3 py-1 text-[7px] leading-snug text-white/90">
          <strong>Disclaimer:</strong> The beneficiary numbers are screen-level and the integrated data of all
          country projects are a sum that may reflect enhanced contributions to the beneficiary totals.
          Data source: PAID quarterly submissions, FPMIS. Livestock interventions data cover all 55 AU member state distributions.
        </div>
      </main>
    </div>
  );
}

/* ── Panel wrapper ── */
function Panel({ title, children, noPad }: { title: string; children: React.ReactNode; noPad?: boolean }) {
  return (
    <div className="bg-white dark:bg-gray-800">
      <h4 className="border-b border-gray-100 px-2 py-1 text-[8px] font-bold text-[#003366] dark:border-gray-700 dark:text-blue-300">
        &#9679; {title}
      </h4>
      <div className={noPad ? '' : 'p-2'}>{children}</div>
    </div>
  );
}

/* ── Sidebar filter ── */
function SideFilter({ label, value, options, onChange, disabled }: {
  label: string; value?: string; options: string[];
  onChange?: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div className="border-b border-gray-100 px-2 py-[5px] dark:border-gray-800">
      <label className="text-[8px] font-bold uppercase tracking-wider text-gray-400">{label}</label>
      <select disabled={disabled} value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-[2px] w-full rounded border border-gray-200 bg-gray-50 px-1 py-[2px] text-[9px] disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800">
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
