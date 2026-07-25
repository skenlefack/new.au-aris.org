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
  DollarSign,
  ChevronDown,
  RotateCcw,
  NotebookPen,
  BarChart3,
  Syringe,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDomainSubmissions } from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import {
  aggregatePaidSubmissions,
  filterPaidSubmissions,
  extractPaidFilterOptions,
  PAID_QUARTERS,
  type PaidFilters,
} from '@/lib/paid';
import type { CountryOutbreakData } from '@/components/dashboard/demo-data';

const ChoroplethMap = dynamic(
  () => import('@/components/dashboard/maps/ChoroplethMap').then((m) => m.ChoroplethMap),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);

const fmt = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

const PIE_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#92400e', '#475569', '#be185d', '#4d7c0f'];

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
/*  PAID Dashboard — FAO Reference Layout                              */
/* ================================================================== */

export default function PaidDashboardPage() {
  const t = useTranslations('paid');
  const [filters, setFilters] = useState<PaidFilters>({});
  const [activeTab, setActiveTab] = useState<'outcomes' | 'activities'>('outcomes');
  const [mapCountry, setMapCountry] = useState<string | undefined>();

  const subsQ = useDomainSubmissions('paid', { refreshInterval: 30_000 });
  const rawSubs: any[] = Array.isArray(subsQ.data?.data) ? subsQ.data.data : [];
  const filtered = useMemo(() => filterPaidSubmissions(rawSubs, filters), [rawSubs, filters]);
  const agg = useMemo(() => aggregatePaidSubmissions(filtered), [filtered]);
  const filterOpts = useMemo(() => extractPaidFilterOptions(rawSubs), [rawSubs]);

  const loading = subsQ.isLoading;
  const hasF = !!(filters.quarter || filters.country || filters.project);

  const countryArr = useMemo(() => Array.from(agg.byCountry.values()).sort((a, b) => b.quantityImplemented - a.quantityImplemented), [agg]);
  const activityArr = useMemo(() => Array.from(agg.byActivity.values()).sort((a, b) => b.quantityImplemented - a.quantityImplemented).slice(0, 10), [agg]);
  const projectArr = useMemo(() => Array.from(agg.byProject.values()).sort((a, b) => b.quantityImplemented - a.quantityImplemented), [agg]);
  const quarterArr = useMemo(() => Array.from(agg.byQuarter.values()).sort((a, b) => a.quarter.localeCompare(b.quarter)), [agg]);

  // Build map data from countries_benefiting across all submissions
  const mapData: CountryOutbreakData[] = useMemo(() => {
    const benefitingMap = new Map<string, { code: string; name: string; count: number }>();
    // Collect all benefiting countries from raw submissions
    for (const sub of filtered) {
      const d = (sub as any).data ?? {};
      const rc = d.recs_countries ?? {};
      const countries: string[] = Array.isArray(rc.countries) ? rc.countries : [];
      for (const code of countries) {
        const existing = benefitingMap.get(code);
        if (existing) {
          existing.count += 1;
        } else {
          benefitingMap.set(code, { code, name: code, count: 1 });
        }
      }
      // Also include the implementation country itself
      const metaC = d.__meta_country_of_implementation;
      const implCode = metaC?.code || d.adm0_code || '';
      if (implCode && !benefitingMap.has(implCode)) {
        const implName = metaC?.name?.en || metaC?.name?.fr || implCode;
        benefitingMap.set(implCode, { code: implCode, name: implName, count: 1 });
      } else if (implCode) {
        benefitingMap.get(implCode)!.count += 1;
      }
    }
    // Fallback to byCountry if no countries_benefiting data
    if (benefitingMap.size === 0) {
      return Array.from(agg.byCountry.values()).map((c) => ({
        code: c.code, name: c.country, outbreaks: c.submissions,
        cases: c.quantityImplemented, deaths: c.quantityTargeted,
        vaccinations: c.projects.size, submissions: c.submissions, rec: '',
      }));
    }
    return Array.from(benefitingMap.values()).map((c) => ({
      code: c.code, name: c.name, outbreaks: c.count,
      cases: c.count, deaths: 0,
      vaccinations: c.count, submissions: c.count, rec: '',
    }));
  }, [filtered, agg]);

  // For expenditure donut — group by project title
  const expenditureByProject = useMemo(() =>
    projectArr.filter((p) => p.expenditure > 0).sort((a, b) => b.expenditure - a.expenditure),
  [projectArr]);
  const totalExpenditure = agg.totalExpenditure;

  // Progress gauge
  const progressPct = agg.completionRate;

  if (loading) {
    return (
      <div className="space-y-4 bg-white p-6 dark:bg-gray-950">
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="grid grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        <div className="grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-[440px] rounded-lg lg:col-span-6" />
          <Skeleton className="h-[440px] rounded-lg lg:col-span-3" />
          <Skeleton className="h-[440px] rounded-lg lg:col-span-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* ═══ FILTER BAR ═══ */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-5 py-2.5 dark:border-gray-800 dark:bg-gray-950">
        <FilterSelect label="Quarter" value={filters.quarter} options={[...PAID_QUARTERS]}
          onChange={(v) => setFilters({ ...filters, quarter: v || undefined })} />
        <FilterSelect label="Country" value={filters.country} options={filterOpts.countries}
          onChange={(v) => setFilters({ ...filters, country: v || undefined })} />
        <FilterSelect label="Project" value={filters.project} options={filterOpts.projects}
          onChange={(v) => setFilters({ ...filters, project: v || undefined })} />
        <FilterSelect label="Year" value="2026" options={['2026']} onChange={() => {}} />

        {hasF && (
          <button onClick={() => setFilters({})} className="ml-1 flex items-center gap-1 text-[11px] font-medium text-red-500 hover:text-red-700">
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <TabBtn active={activeTab === 'outcomes'} onClick={() => setActiveTab('outcomes')}>AMERT Outcomes</TabBtn>
          <TabBtn active={activeTab === 'activities'} onClick={() => setActiveTab('activities')}>Activities</TabBtn>
        </div>

        {rawSubs.length > 0 && (
          <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
            Live &middot; {rawSubs.length} records
          </span>
        )}

        <Link href="/paid-collecte" className="rounded bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700">
          <NotebookPen className="mr-1 inline h-3 w-3" />Collecte
        </Link>
      </div>

      {/* ═══ KPI ROW — full width grid ═══ */}
      <div className="grid grid-cols-4 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 lg:grid-cols-8">
        <KpiCell value={String(agg.totalProjects)} label="PROJECTS" color="#2563eb" icon={<FolderKanban className="h-4 w-4" />} />
        <KpiCell value={String(agg.totalCountriesBenefiting)} label="COUNTRIES" color="#059669" icon={<MapPin className="h-4 w-4" />} />
        <KpiCell value={String(agg.totalRecs)} label="RECS" color="#dc2626" icon={<Building2 className="h-4 w-4" />} />
        <KpiCell value={String(agg.totalSubmissions)} label="SUBMISSIONS" color="#2563eb" icon={<FileCheck2 className="h-4 w-4" />} />
        <KpiCell value={`$${fmt(agg.totalExpenditure)}`} label="EXPENDITURE" color="#d97706" icon={<DollarSign className="h-4 w-4" />} />
        <KpiCell value={fmt(agg.totalAnimalsVaccinated)} label="ANIMALS VACCINATED" color="#059669" icon={<Syringe className="h-4 w-4" />} />
        <KpiCell value={fmt(agg.totalQuantityTargeted)} label="QTY TARGETED" color="#7c3aed" icon={<BarChart3 className="h-4 w-4" />} />
        <KpiCell value={`${progressPct}%`} label="COMPLETION" color="#059669" icon={<span className="text-[14px]">◔</span>} />
      </div>

      {/* ═══ MAIN GRID ═══ */}
      <div className="grid gap-0 lg:grid-cols-12">
        {/* ──── LEFT: MAP (6 cols) ──── */}
        <div className="border-r border-gray-200 lg:col-span-6 dark:border-gray-800">
          <SectionTitle>RECs and Countries Benefitting</SectionTitle>
          <div className="relative h-[460px]">
            <ChoroplethMap
              title=""
              data={mapData}
              indicator="submissions"
              height="460px"
              bare
              mode="benefiting"
              selectedCountry={mapCountry}
              onCountryClick={(code) => setMapCountry(mapCountry === code ? undefined : code)}
            />
          </div>

          {/* Activity Table */}
          {activeTab === 'activities' && (
            <div className="border-t border-gray-200 dark:border-gray-800">
              <SectionTitle>Activity Breakdown</SectionTitle>
              <div className="max-h-[200px] overflow-auto">
                <table className="w-full text-[10px]">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-bold text-gray-600 dark:text-gray-400">PAID ACTIVITY</th>
                      <th className="px-3 py-1.5 text-right font-bold text-gray-600 dark:text-gray-400">QTY IMPLEMENTED</th>
                      <th className="px-3 py-1.5 text-right font-bold text-gray-600 dark:text-gray-400">QTY TARGETED</th>
                      <th className="px-3 py-1.5 text-right font-bold text-gray-600 dark:text-gray-400">SUBMISSIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(agg.byActivity.values()).sort((a, b) => b.quantityImplemented - a.quantityImplemented).map((a) => (
                      <tr key={a.label} className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900">
                        <td className="max-w-[250px] truncate px-3 py-1.5 text-gray-700 dark:text-gray-300" title={a.label}>{a.label}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-gray-900 dark:text-white">{a.quantityImplemented.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{a.quantityTargeted.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{a.submissions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ──── MIDDLE (3 cols) ──── */}
        <div className="border-r border-gray-200 lg:col-span-3 dark:border-gray-800">
          {/* Quarterly Progress */}
          <SectionTitle>{totalExpenditure > 0 ? 'Expenditure Trend (USD)' : 'Quarterly Submissions'}</SectionTitle>
          <div className="px-4 py-3">
            <p className="mb-2 text-[9px] text-gray-400">Year to Date</p>
            <div className="flex items-end gap-2" style={{ height: 110 }}>
              {quarterArr.map((q) => {
                const metric = totalExpenditure > 0 ? q.expenditure : q.submissions;
                const maxVal = Math.max(...quarterArr.map(qq => totalExpenditure > 0 ? qq.expenditure : qq.submissions), 1);
                const h = Math.max(12, Math.round((metric / maxVal) * 90));
                return (
                  <div key={q.quarter} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[8px] font-bold text-gray-700 dark:text-gray-300">
                      {totalExpenditure > 0 ? `$${fmt(metric)}` : metric}
                    </span>
                    <div className="w-full rounded-t bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-500" style={{ height: h }} />
                    <span className="text-[9px] font-medium text-gray-500">{q.quarter}</span>
                  </div>
                );
              })}
              {quarterArr.length === 0 && (
                <div className="flex h-full w-full flex-col items-center justify-center text-gray-300">
                  <BarChart3 className="h-6 w-6" /><p className="mt-1 text-[10px]">No quarterly data yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Expenditure by Programme — Donut */}
          <div className="border-t border-gray-200 dark:border-gray-800">
            <SectionTitle>Expenditure by Programme (USD)</SectionTitle>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="relative h-[110px] w-[110px] shrink-0">
                <div className="h-full w-full rounded-full" style={{
                  background: expenditureByProject.length > 0
                    ? conicGradient(expenditureByProject.map((p) => [p.symbol, p.expenditure]), PIE_COLORS)
                    : '#e5e7eb',
                }} />
                <div className="absolute inset-[22px] flex items-center justify-center rounded-full bg-white dark:bg-gray-950">
                  <div className="text-center">
                    <p className="text-[10px] font-extrabold text-gray-900 dark:text-white">${fmt(totalExpenditure)}</p>
                    <p className="text-[7px] text-gray-400">Total</p>
                  </div>
                </div>
              </div>
              <div className="min-w-0 space-y-1">
                {expenditureByProject.slice(0, 6).map((p, i) => (
                  <div key={p.symbol} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="truncate text-[9px] text-gray-600 dark:text-gray-400">{p.title.length > 22 ? p.title.slice(0, 22) + '...' : p.title}</span>
                  </div>
                ))}
                {expenditureByProject.length === 0 && <p className="text-[9px] text-gray-300">No expenditure data</p>}
              </div>
            </div>
          </div>

          {/* Male & Female Trainers */}
          <div className="border-t border-gray-200 dark:border-gray-800">
            <SectionTitle>Male &amp; Female Trainers</SectionTitle>
            <div className="flex items-center justify-center gap-8 px-4 py-4">
              <PersonStat gender="female" value={agg.totalFemale} total={agg.totalTrained} />
              <PersonStat gender="male" value={agg.totalMale} total={agg.totalTrained} />
            </div>
            {agg.totalTrained === 0 && (
              <p className="pb-3 text-center text-[9px] text-gray-300">No training data yet</p>
            )}
          </div>
        </div>

        {/* ──── RIGHT (3 cols) ──── */}
        <div className="lg:col-span-3">
          {/* People Trained — or Submissions summary when no training data */}
          {agg.totalTrained > 0 ? (
            <>
              <SectionTitle>People Trained</SectionTitle>
              <div className="flex items-center justify-center gap-8 px-4 py-4">
                <PersonStat gender="female" value={agg.totalFemale} total={agg.totalTrained} />
                <PersonStat gender="male" value={agg.totalMale} total={agg.totalTrained} />
              </div>
            </>
          ) : (
            <>
              <SectionTitle>Submissions by Country</SectionTitle>
              <div className="space-y-1 px-4 py-3">
                {countryArr.slice(0, 6).map((c) => {
                  const maxS = countryArr[0]?.submissions || 1;
                  const pct = Math.round((c.submissions / maxS) * 100);
                  return (
                    <div key={c.country} className="flex items-center gap-2">
                      <span className="w-[55px] shrink-0 truncate text-right text-[9px] font-medium text-gray-600 dark:text-gray-400">{c.country}</span>
                      <div className="h-[13px] flex-1 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-800">
                        <div className="h-full rounded-sm bg-blue-600" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-[18px] text-right text-[9px] font-bold text-gray-900 dark:text-white">{c.submissions}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Implementation by Project — Big Donut */}
          <div className="border-t border-gray-200 dark:border-gray-800">
            <SectionTitle>Implementation by Project</SectionTitle>
            <div className="px-4 py-3">
              <div className="flex items-start gap-4">
                {/* Donut */}
                <div className="relative h-[130px] w-[130px] shrink-0">
                  <div className="h-full w-full rounded-full shadow-sm" style={{
                    background: projectArr.length > 0
                      ? conicGradient(projectArr.map((p) => [p.symbol, p.quantityImplemented]), PIE_COLORS)
                      : '#e5e7eb',
                  }} />
                  <div className="absolute inset-[30px] flex items-center justify-center rounded-full bg-white dark:bg-gray-950">
                    <div className="text-center">
                      <p className="text-2xl font-black text-blue-600">{agg.totalProjects}</p>
                      <p className="text-[8px] uppercase tracking-wider text-gray-400">Projects</p>
                    </div>
                  </div>
                </div>
                {/* Legend */}
                <div className="min-w-0 space-y-1.5 pt-1">
                  {projectArr.map((p, i) => (
                    <div key={p.symbol} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-gray-700 dark:text-gray-300">{p.symbol}</span>
                      <span className="shrink-0 text-[10px] font-bold text-gray-900 dark:text-white">{fmt(p.quantityImplemented)}</span>
                      <span className="shrink-0 text-[9px] text-gray-400">{p.countries.size} ctry</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Top Activities by Expenditure */}
          <div className="border-t border-gray-200 dark:border-gray-800">
            <SectionTitle>Top PAID Activities by Quantity</SectionTitle>
            <div className="space-y-1.5 px-4 py-3">
              {activityArr.map((act) => {
                const max = activityArr[0]?.quantityImplemented || 1;
                const pct = Math.round((act.quantityImplemented / max) * 100);
                return (
                  <div key={act.label}>
                    <div className="flex items-center justify-between">
                      <span className="max-w-[65%] truncate text-[9px] text-gray-600 dark:text-gray-400" title={act.label}>{act.label}</span>
                      <span className="text-[9px] font-bold text-gray-900 dark:text-white">{fmt(act.quantityImplemented)}</span>
                    </div>
                    <div className="mt-0.5 h-[10px] w-full overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-800">
                      <div className="h-full rounded-sm bg-emerald-600 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {activityArr.length === 0 && <p className="py-4 text-center text-[10px] text-gray-300">No data</p>}
            </div>
          </div>

          {/* Projects by Country */}
          <div className="border-t border-gray-200 dark:border-gray-800">
            <SectionTitle>Projects by Country</SectionTitle>
            <div className="space-y-1 px-4 py-3">
              {countryArr.slice(0, 8).map((c) => {
                const maxP = Math.max(...countryArr.map(cc => cc.projects.size), 1);
                const pct = Math.round((c.projects.size / maxP) * 100);
                return (
                  <div key={c.country} className="flex items-center gap-2">
                    <span className="w-[60px] shrink-0 truncate text-right text-[9px] text-gray-600 dark:text-gray-400">{c.country}</span>
                    <div className="h-[13px] flex-1 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-800">
                      <div className="h-full rounded-sm bg-blue-600" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-[18px] text-right text-[9px] font-bold text-gray-900 dark:text-white">{c.projects.size}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="border-t border-gray-200 bg-gray-50 px-5 py-2 text-[9px] text-gray-400 dark:border-gray-800 dark:bg-gray-900">
        Source: AU-IBAR M&E System &middot; PAID quarterly submissions via ARIS 4.0 &middot; Last updated: {new Date().toLocaleDateString()} &middot; Auto-refresh 30s
      </div>
    </div>
  );
}

/* ═══════════ Sub-components ═══════════ */

function FilterSelect({ label, value, options, onChange }: {
  label: string; value?: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="relative inline-block">
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded border border-gray-300 bg-white py-1 pl-2 pr-6 text-[11px] text-gray-700 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        <option value="">{label}: All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3 py-1 text-[11px] font-semibold transition ${
      active ? 'border-b-2 border-blue-600 text-blue-700 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'
    }`}>{children}</button>
  );
}

function KpiCell({ value, label, color, icon, dark }: {
  value: string; label: string; color?: string; icon?: React.ReactNode; dark?: boolean;
}) {
  if (dark) {
    return (
      <div className="flex items-center justify-center gap-2 border-r border-gray-200 bg-gray-900 px-2 py-3 text-white last:border-r-0 dark:border-gray-700 dark:bg-gray-800">
        <DollarSign className="h-4 w-4 text-gray-500" />
        <div className="text-center">
          <p className="text-xl font-black leading-tight">{value}</p>
          <p className="text-[8px] uppercase tracking-widest text-gray-400">{label}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-2 border-r border-gray-200 bg-white px-2 py-3 last:border-r-0 dark:border-gray-800 dark:bg-gray-950">
      <p className="text-2xl font-black leading-tight" style={{ color }}>{value}</p>
      {icon && <span style={{ color }} className="opacity-60">{icon}</span>}
      <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 px-4 py-2 dark:border-gray-800">
      <h3 className="text-[11px] font-bold text-gray-900 dark:text-white">{children}</h3>
    </div>
  );
}

function PersonStat({ gender, value, total }: { gender: 'female' | 'male'; value: number; total: number }) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  const color = gender === 'female' ? '#ec4899' : '#3b82f6';
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Person icon */}
      <svg width="36" height="48" viewBox="0 0 36 48" fill="none">
        <circle cx="18" cy="10" r="8" fill={color} />
        <path d="M4 46c0-7.7 6.3-14 14-14s14 6.3 14 14" stroke={color} strokeWidth="4" fill="none" />
      </svg>
      <p className="text-[9px] font-semibold capitalize text-gray-500">{gender}</p>
      <p className="text-lg font-black" style={{ color }}>{fmt(value)}</p>
      <p className="text-[9px] text-gray-400">({pct}%)</p>
    </div>
  );
}
