'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
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

/* ── Helpers ── */
const fmt = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

const PIE_COLORS = ['#1565C0', '#2E7D32', '#E65100', '#6A1B9A', '#00838F', '#C62828', '#4E342E', '#37474F', '#AD1457', '#33691E', '#0277BD', '#558B2F'];

/* ── Africa SVG outline (simplified) ── */
const AFRICA_PATH = 'M204,18 C220,12 240,15 255,20 L270,18 C280,22 295,30 305,45 L320,55 C330,65 338,80 342,98 L348,115 C352,130 355,148 352,168 L355,188 C352,205 348,225 338,245 L342,265 C338,282 330,298 318,315 L305,332 C292,345 278,358 262,365 L245,372 C230,378 215,380 200,378 L185,375 C170,370 158,362 148,352 L138,338 C128,322 118,305 112,285 L105,268 C98,248 92,228 88,208 L82,188 C78,168 76,148 78,128 L82,108 C86,88 94,68 105,52 L118,38 C132,25 148,18 168,15 L188,15 Z';

const COUNTRY_POS: Record<string, [number, number]> = {
  DZ:[195,52],AO:[188,262],BJ:[173,152],BW:[225,298],BF:[162,132],BI:[240,238],CM:[188,158],
  CF:[218,148],TD:[208,128],KM:[285,258],CG:[205,232],CD:[228,228],CI:[155,152],DJ:[272,118],
  EG:[245,62],GQ:[185,172],ER:[262,112],SZ:[240,312],ET:[258,138],GA:[192,195],GM:[138,128],
  GH:[165,148],GN:[148,138],GW:[138,135],KE:[262,195],LS:[238,318],LR:[148,148],LY:[218,58],
  MG:[295,268],MW:[255,262],ML:[165,118],MR:[152,102],MZ:[262,278],NA:[212,298],NE:[185,118],
  NG:[182,145],RW:[242,232],SN:[138,122],SL:[145,145],SO:[275,148],ZA:[228,322],SS:[238,158],
  SD:[242,108],TZ:[258,238],TG:[170,148],TN:[195,38],UG:[248,205],ZM:[238,272],ZW:[242,298],
};

/* ── Conic gradient helper ── */
function conicGradient(entries: [string, number][], colors: string[]): string {
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  let acc = 0;
  const stops: string[] = [];
  entries.forEach(([, v], i) => {
    const start = (acc / total) * 360;
    acc += v;
    const end = (acc / total) * 360;
    stops.push(`${colors[i % colors.length]} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`);
  });
  return `conic-gradient(${stops.join(', ')})`;
}

/* ================================================================== */
/*  PAID Dashboard — FAO-style                                         */
/* ================================================================== */

export default function PaidDashboardPage() {
  const t = useTranslations('paid');
  const [filters, setFilters] = useState<PaidFilters>({});

  const campaignsQuery = useCollectionCampaigns({ domain: 'paid', limit: 50 });
  const campaigns: any[] = Array.isArray(campaignsQuery.data?.data) ? campaignsQuery.data.data : [];
  const firstActive = campaigns.find((c: any) => c.status === 'ACTIVE');
  const subsQuery = useCampaignSubmissions(firstActive?.id, { limit: 5000 });
  const rawSubs: any[] = Array.isArray(subsQuery.data?.data) ? subsQuery.data.data : [];

  const filtered = useMemo(() => filterPaidSubmissions(rawSubs, filters), [rawSubs, filters]);
  const agg = useMemo(() => aggregatePaidSubmissions(filtered), [filtered]);

  const countries = useMemo(() => [...new Set(rawSubs.map((s: any) => s.data?.adm0_name).filter(Boolean))].sort(), [rawSubs]);
  const projects = useMemo(() => [...new Set(rawSubs.map((s: any) => s.data?.prj_symbol).filter(Boolean))].sort(), [rawSubs]);

  const isLoading = campaignsQuery.isLoading || subsQuery.isLoading;
  const hasFilters = !!(filters.quarter || filters.country || filters.sector || filters.project);

  const sectorArr = useMemo(() => Array.from(agg.bySector.values()).sort((a, b) => b.projects.size - a.projects.size), [agg]);
  const countryArr = useMemo(() => Array.from(agg.byCountry.values()).sort((a, b) => b.beneficiaries - a.beneficiaries), [agg]);
  const activityArr = useMemo(() => Array.from(agg.byActivity.entries()).sort(([, a], [, b]) => b - a).slice(0, 12), [agg]);
  const projectArr = useMemo(() => Array.from(agg.byProject.values()).sort((a, b) => b.beneficiaries - a.beneficiaries), [agg]);
  const totalSP = sectorArr.reduce((s, e) => s + e.projects.size, 0) || 1;
  const maxCB = countryArr[0]?.beneficiaries || 1;
  const totalAB = activityArr.reduce((s, [, v]) => s + v, 0) || 1;
  const totalPB = projectArr.reduce((s, e) => s + e.beneficiaries, 0) || 1;

  // Map
  const countryBenefMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of agg.byCountry.values()) if (c.code) m.set(c.code, c.beneficiaries);
    return m;
  }, [agg]);
  const maxMB = Math.max(1, ...countryBenefMap.values());

  return (
    <div className="flex min-h-screen bg-[#f5f6fa] dark:bg-gray-950">
      {/* ══════════ LEFT SIDEBAR ══════════ */}
      <aside className="hidden w-[155px] shrink-0 flex-col border-r border-gray-300 bg-white lg:flex dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:border-gray-700">
          Filters
        </div>

        {[
          { label: 'Year', value: '2026', disabled: true, opts: ['2026'] },
        ].map((f) => (
          <div key={f.label} className="border-b border-gray-100 px-2.5 py-1.5 dark:border-gray-800">
            <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{f.label}</label>
            <select disabled={f.disabled} className="mt-0.5 w-full rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] dark:border-gray-700 dark:bg-gray-800">
              {f.opts.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}

        <FilterSelect label={t('filterQuarter')} value={filters.quarter} options={PAID_QUARTERS as unknown as string[]}
          onChange={(v) => setFilters({ ...filters, quarter: v || undefined })} />
        <FilterSelect label={t('filterCountry')} value={filters.country} options={countries}
          onChange={(v) => setFilters({ ...filters, country: v || undefined })} />
        <FilterSelect label={t('filterSector')} value={filters.sector} options={PAID_SECTORS.map((s) => s.name.en)}
          onChange={(v) => setFilters({ ...filters, sector: v || undefined })} />
        <FilterSelect label={t('filterProject')} value={filters.project} options={projects}
          onChange={(v) => setFilters({ ...filters, project: v || undefined })} />

        {hasFilters && (
          <div className="px-2.5 py-1.5">
            <button onClick={() => setFilters({})} className="flex w-full items-center justify-center gap-1 rounded bg-red-50 py-1 text-[9px] font-bold text-red-600 hover:bg-red-100">
              <RotateCcw className="h-2.5 w-2.5" /> Reset
            </button>
          </div>
        )}

        <div className="mt-auto border-t border-gray-200 px-2.5 py-2 dark:border-gray-700">
          <Link href="/paid-collecte" className="flex items-center gap-1 rounded bg-[#003366] px-2 py-1 text-[9px] font-bold text-white hover:bg-[#004488]">
            <NotebookPen className="h-3 w-3" /> Collecte PAID
          </Link>
        </div>
      </aside>

      {/* ══════════ MAIN ══════════ */}
      <main className="min-w-0 flex-1">
        {/* ── HEADER BAR ── */}
        <div className="flex items-center justify-between bg-[#003366] px-4 py-2">
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-white/70" />
            <span className="text-[11px] font-bold tracking-wide text-white">LIVESTOCK INTERVENTIONS* — AU-IBAR PAID OVERVIEW</span>
          </div>
          {hasFilters && (
            <button onClick={() => setFilters({})} className="rounded bg-white/20 px-2 py-0.5 text-[9px] font-bold text-white hover:bg-white/30">
              Click to reset filter
            </button>
          )}
        </div>

        {/* ── 8 KPI ROW ── */}
        <div className="grid grid-cols-4 border-b border-gray-300 bg-white lg:grid-cols-8 dark:bg-gray-900">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)
          ) : (
            [
              { val: String(agg.totalProjects), label: 'Projects', color: '#003366' },
              { val: String(agg.totalRegions), label: 'Regions', color: '#003366' },
              { val: fmt(agg.totalBeneficiaries), label: '# received donors', color: '#003366' },
              { val: fmt(agg.totalHouseholds), label: 'HH', color: '#003366' },
              { val: fmt(agg.totalTrained), label: 'trained', color: '#003366' },
              { val: fmt(agg.totalFemale), label: 'female', color: '#003366' },
              { val: fmt(agg.totalDisabled), label: 'people w/ disability', color: '#003366' },
              { val: `USD ${fmt(agg.totalQuantityImplemented)}`, label: 'budget delivery', color: '#003366' },
            ].map((k, i) => (
              <div key={i} className="border-r border-gray-200 px-1.5 py-1.5 text-center last:border-r-0 dark:border-gray-700">
                <p className="text-sm font-black leading-tight text-[#003366] lg:text-base dark:text-blue-300">{k.val}</p>
                <p className="text-[7px] leading-tight text-gray-400">{k.label}</p>
              </div>
            ))
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-2 p-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-48 rounded" />)}</div>
        ) : (
          <>
            {/* ── ROW 1: 4 panels ── */}
            <div className="grid grid-cols-2 gap-[1px] bg-gray-300 lg:grid-cols-4 dark:bg-gray-700">
              {/* 1. % Projects by Category — PIE */}
              <Panel title="% Projects by Category">
                <div className="flex gap-2">
                  <div className="h-24 w-24 shrink-0 rounded-full" style={{
                    background: sectorArr.length > 0
                      ? conicGradient(sectorArr.map((e) => [e.sector, e.projects.size]), sectorArr.map((e) => SECTOR_COLORS[e.sector] ?? '#9E9E9E'))
                      : '#e5e7eb'
                  }} />
                  <div className="min-w-0 space-y-0.5 overflow-hidden">
                    {sectorArr.slice(0, 7).map((e) => (
                      <div key={e.sector} className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: SECTOR_COLORS[e.sector] ?? '#9E9E9E' }} />
                        <span className="truncate text-[8px] text-gray-500">{e.sector}</span>
                      </div>
                    ))}
                    <p className="text-[8px] text-gray-400">{totalSP} Total projects</p>
                  </div>
                </div>
              </Panel>

              {/* 2. Beneficiaries reached by donor — DONUT */}
              <Panel title="Beneficiaries reached by donor">
                <div className="flex gap-2">
                  <div className="relative h-24 w-24 shrink-0 rounded-full" style={{
                    background: projectArr.length > 0
                      ? conicGradient(projectArr.map((e) => [e.symbol, e.beneficiaries]), PIE_COLORS)
                      : '#e5e7eb'
                  }}>
                    <div className="absolute inset-3 rounded-full bg-white dark:bg-gray-800" />
                  </div>
                  <div className="min-w-0 space-y-0.5 overflow-hidden">
                    {projectArr.slice(0, 6).map((e, i) => (
                      <div key={e.symbol} className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="truncate text-[8px] text-gray-500">{e.symbol.split('/').pop()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              {/* 3. Livestock restocking — BARS */}
              <Panel title="Livestock restocking and distribution">
                <div className="space-y-[3px]">
                  {countryArr.slice(0, 10).map((e) => {
                    const pct = Math.round((e.beneficiaries / maxCB) * 100);
                    return (
                      <div key={e.country} className="flex items-center gap-1">
                        <span className="w-10 shrink-0 text-right text-[8px] font-medium text-gray-500">{e.code || e.country.slice(0, 3)}</span>
                        <div className="h-[10px] flex-1 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-700">
                          <div className="h-full rounded-sm bg-teal-600" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              {/* 4. Projects that include activities */}
              <Panel title="Projects that include the following activities">
                <div className="space-y-[3px]">
                  {activityArr.slice(0, 10).map(([act, count], idx) => {
                    const max = activityArr[0]?.[1] || 1;
                    const pct = Math.round((count / max) * 100);
                    return (
                      <div key={act} className="flex items-center gap-1">
                        <span className="w-24 shrink-0 truncate text-right text-[7px] text-gray-500" title={act}>{act}</span>
                        <div className="h-[10px] flex-1 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-700">
                          <div className="h-full rounded-sm" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        </div>
                        <span className="w-5 text-right text-[7px] font-bold text-gray-600">{count}</span>
                      </div>
                    );
                  })}
                  <p className="text-right text-[7px] text-gray-400">{activityArr.reduce((s, [, v]) => s + v, 0)} Total projects</p>
                </div>
              </Panel>
            </div>

            {/* ── ROW 2: 3 panels ── */}
            <div className="grid grid-cols-1 gap-[1px] bg-gray-300 lg:grid-cols-3 dark:bg-gray-700">
              {/* 5. Africa MAP */}
              <Panel title="Beneficiaries per country">
                <svg viewBox="60 15 300 340" className="mx-auto w-full max-w-[260px]">
                  {/* Africa outline */}
                  <path d={AFRICA_PATH} fill="#dce3ed" stroke="#b0bec5" strokeWidth="0.8" className="dark:fill-gray-700 dark:stroke-gray-600" />
                  {/* Country dots */}
                  {Object.entries(COUNTRY_POS).map(([code, [x, y]]) => {
                    const b = countryBenefMap.get(code) ?? 0;
                    const r = b > 0 ? Math.max(2.5, Math.min(10, (b / maxMB) * 10)) : 1.5;
                    return (
                      <circle key={code} cx={x} cy={y} r={r}
                        fill={b > 0 ? '#1565C0' : '#b0bec5'} opacity={b > 0 ? 0.85 : 0.3}>
                        <title>{code}: {b > 0 ? fmt(b) : '—'}</title>
                      </circle>
                    );
                  })}
                </svg>
              </Panel>

              {/* 6. Beneficiaries by country — BAR */}
              <Panel title="Beneficiaries by country">
                <div className="space-y-[3px]">
                  {countryArr.slice(0, 15).map((e) => {
                    const pct = Math.round((e.beneficiaries / maxCB) * 100);
                    return (
                      <div key={e.country} className="flex items-center gap-1">
                        <span className="w-14 shrink-0 truncate text-right text-[8px] font-medium text-gray-500">{e.country}</span>
                        <div className="h-[10px] flex-1 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-700">
                          <div className="h-full rounded-sm bg-blue-700" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 text-right text-[8px] font-bold text-gray-600 dark:text-gray-300">{fmt(e.beneficiaries)}</span>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              {/* 7. Beneficiaries by type of activity — PIE */}
              <Panel title="Beneficiaries by type of activity">
                <div className="flex gap-2">
                  <div className="h-28 w-28 shrink-0 rounded-full" style={{
                    background: activityArr.length > 0
                      ? conicGradient(activityArr, PIE_COLORS)
                      : '#e5e7eb'
                  }} />
                  <div className="min-w-0 space-y-0.5 overflow-hidden">
                    {activityArr.slice(0, 8).map(([act, count], idx) => {
                      const pct = Math.round((count / totalAB) * 100);
                      return (
                        <div key={act} className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                          <span className="truncate text-[7px] text-gray-500" title={act}>{act}</span>
                        </div>
                      );
                    })}
                    <p className="text-[7px] italic text-gray-400">% annual target by species-level interventions</p>
                  </div>
                </div>
              </Panel>
            </div>
          </>
        )}

        {/* ── RED FOOTER ── */}
        <div className="bg-[#c0392b] px-3 py-1.5 text-[8px] leading-tight text-white/90">
          <strong>Disclaimer:</strong> The beneficiary numbers are screen-level and the integrated data of all
          country projects are a sum that may reflect enhanced contributions to the beneficiary totals. An
          individual may receive multiple interventions. Data source: PAID quarterly submissions, FPMIS.
          Livestock interventions data cover all 55 AU member state distributions.
        </div>
      </main>
    </div>
  );
}

/* ── Shared Panel wrapper ── */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-2.5 dark:bg-gray-800">
      <h4 className="mb-1.5 text-[9px] font-bold text-[#003366] dark:text-blue-300">&#9679; {title}</h4>
      {children}
    </div>
  );
}

/* ── Sidebar filter select ── */
function FilterSelect({ label, value, options, onChange }: {
  label: string; value?: string; options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="border-b border-gray-100 px-2.5 py-1.5 dark:border-gray-800">
      <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</label>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] dark:border-gray-700 dark:bg-gray-800">
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
