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
  Filter,
  NotebookPen,
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
  type PaidFilters,
} from '@/lib/paid';

/* ── Format large numbers ── */
const fmt = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

const ACTIVITY_COLORS = ['#1565C0', '#2E7D32', '#E65100', '#6A1B9A', '#00838F', '#C62828', '#4E342E', '#37474F', '#AD1457', '#33691E'];

/* ================================================================== */
/*  PAID Dashboard — FAO-style Visualization                           */
/* ================================================================== */

export default function PaidDashboardPage() {
  const t = useTranslations('paid');

  // ── Filters state ──
  const [filters, setFilters] = useState<PaidFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── Data: fetch all PAID campaigns + submissions ──
  const campaignsQuery = useCollectionCampaigns({ domain: 'paid', limit: 50 });
  const campaigns: any[] = Array.isArray(campaignsQuery.data?.data) ? campaignsQuery.data.data : [];
  const activeCampaignIds = campaigns.filter((c: any) => c.status === 'ACTIVE').map((c: any) => c.id);

  // Fetch submissions from first active campaign
  const subsQuery = useCampaignSubmissions(activeCampaignIds[0], { limit: 5000 });
  const rawSubmissions: any[] = Array.isArray(subsQuery.data?.data) ? subsQuery.data.data : [];

  // ── Filter + Aggregate ──
  const filtered = useMemo(() => filterPaidSubmissions(rawSubmissions, filters), [rawSubmissions, filters]);
  const agg = useMemo(() => aggregatePaidSubmissions(filtered), [filtered]);

  // Extract unique values for filters
  const countries = useMemo(() => [...new Set(rawSubmissions.map((s: any) => s.data?.adm0_name).filter(Boolean))].sort(), [rawSubmissions]);
  const projects = useMemo(() => [...new Set(rawSubmissions.map((s: any) => s.data?.prj_symbol).filter(Boolean))].sort(), [rawSubmissions]);

  const isLoading = campaignsQuery.isLoading || subsQuery.isLoading;

  // Chart data
  const sectorEntries = useMemo(() => Array.from(agg.bySector.values()).sort((a, b) => b.projects.size - a.projects.size), [agg]);
  const countryEntries = useMemo(() => Array.from(agg.byCountry.values()).sort((a, b) => b.beneficiaries - a.beneficiaries).slice(0, 15), [agg]);
  const activityEntries = useMemo(() => Array.from(agg.byActivity.entries()).sort(([, a], [, b]) => b - a).slice(0, 10), [agg]);
  const totalSectorProjects = sectorEntries.reduce((s, e) => s + e.projects.size, 0) || 1;
  const maxCountryBenef = countryEntries[0]?.beneficiaries || 1;
  const totalActivityBenef = activityEntries.reduce((s, [, v]) => s + v, 0) || 1;

  return (
    <div className="space-y-0">
      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  HEADER BAR — AU-IBAR branding                             */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="rounded-t-xl bg-gradient-to-r from-[#003366] to-[#005599] px-6 py-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
              <Globe2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">LIVESTOCK INTERVENTIONS — AU-IBAR PAID OVERVIEW</h1>
              <p className="text-xs text-blue-200">Programme Activity Information Database — Continental Dashboard</p>
            </div>
          </div>
          <Link
            href="/paid-collecte"
            className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
          >
            <NotebookPen className="h-3.5 w-3.5" /> {t('paidCollecte') || 'Data Collection'}
          </Link>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  FILTERS BAR + 8 KPI CARDS                                 */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="rounded-b-xl border border-t-0 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {/* Filters toggle + inline filter chips */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2 dark:border-gray-700">
          <button onClick={() => setFiltersOpen(!filtersOpen)} className="flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300">
            <Filter className="h-3 w-3" /> Filters
          </button>
          {filters.quarter && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{filters.quarter}</span>}
          {filters.country && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">{filters.country}</span>}
          {filters.sector && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">{filters.sector}</span>}
          {filters.project && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{filters.project}</span>}
          {(filters.quarter || filters.country || filters.sector || filters.project) && (
            <button onClick={() => setFilters({})} className="text-[10px] text-red-500 hover:underline">Clear</button>
          )}
        </div>

        {/* Collapsible filter panel */}
        {filtersOpen && (
          <div className="flex flex-wrap gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <select value={filters.quarter ?? ''} onChange={(e) => setFilters({ ...filters, quarter: e.target.value || undefined })} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700">
              <option value="">{t('allQuarters')}</option>
              {PAID_QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
            <select value={filters.country ?? ''} onChange={(e) => setFilters({ ...filters, country: e.target.value || undefined })} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700">
              <option value="">{t('allCountries')}</option>
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filters.sector ?? ''} onChange={(e) => setFilters({ ...filters, sector: e.target.value || undefined })} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700">
              <option value="">{t('allSectors')}</option>
              {PAID_SECTORS.map((s) => <option key={s.id} value={s.name.en}>{s.name.en}</option>)}
            </select>
            <select value={filters.project ?? ''} onChange={(e) => setFilters({ ...filters, project: e.target.value || undefined })} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700">
              <option value="">{t('allProjects')}</option>
              {projects.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}

        {/* 8 KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-4 gap-0 divide-x divide-gray-100 px-0 lg:grid-cols-8 dark:divide-gray-700">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <div className="grid grid-cols-4 divide-x divide-gray-100 lg:grid-cols-8 dark:divide-gray-700">
            {[
              { label: t('totalProjects'), value: agg.totalProjects, icon: FolderKanban, color: '#1565C0' },
              { label: t('totalRegions'), value: agg.totalRegions, icon: MapPin, color: '#00838F' },
              { label: t('beneficiariesReached'), value: fmt(agg.totalBeneficiaries), icon: Users, color: '#2E7D32' },
              { label: t('householdsReached'), value: fmt(agg.totalHouseholds), icon: Home, color: '#6A1B9A' },
              { label: t('individualsTrained'), value: fmt(agg.totalTrained), icon: GraduationCap, color: '#E65100' },
              { label: t('femaleTrained'), value: fmt(agg.totalFemale), icon: UserCheck, color: '#AD1457' },
              { label: t('disabledBenef'), value: fmt(agg.totalDisabled), icon: Accessibility, color: '#4E342E' },
              { label: t('budgetDelivery'), value: `${agg.completionRate}%`, icon: DollarSign, color: '#37474F' },
            ].map((c) => (
              <div key={c.label} className="px-3 py-3 text-center">
                <c.icon className="mx-auto h-4 w-4 mb-1" style={{ color: c.color }} />
                <p className="text-lg font-bold text-gray-900 dark:text-white">{c.value}</p>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">{c.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  CHARTS ROW 1 — 3 columns                                  */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isLoading ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* ── % Projects by Category (Sector pie) ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> {t('projectsByCategory')}
            </h4>
            {sectorEntries.length === 0 ? (
              <p className="py-12 text-center text-xs text-gray-400">{t('noCampaignData')}</p>
            ) : (
              <div className="space-y-2.5">
                {sectorEntries.slice(0, 9).map((e) => {
                  const pct = Math.round((e.projects.size / totalSectorProjects) * 100);
                  const color = SECTOR_COLORS[e.sector] ?? '#9E9E9E';
                  return (
                    <div key={e.sector}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-[11px] text-gray-600 dark:text-gray-400">{e.sector}</span>
                        </div>
                        <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">{pct}%</span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
                <p className="pt-1 text-center text-[10px] text-gray-400">{totalSectorProjects} total projects</p>
              </div>
            )}
          </div>

          {/* ── Beneficiaries by Country (bar chart) ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> {t('benefByCountry')}
            </h4>
            {countryEntries.length === 0 ? (
              <p className="py-12 text-center text-xs text-gray-400">{t('noCampaignData')}</p>
            ) : (
              <div className="space-y-1.5">
                {countryEntries.map((e) => {
                  const pct = Math.round((e.beneficiaries / maxCountryBenef) * 100);
                  return (
                    <div key={e.country} className="flex items-center gap-1.5">
                      <span className="w-16 shrink-0 truncate text-right text-[10px] font-medium text-gray-500">{e.country}</span>
                      <div className="h-3.5 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-700">
                        <div className="h-full rounded bg-gradient-to-r from-blue-500 to-blue-700" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-12 shrink-0 text-right text-[10px] font-bold text-gray-700 dark:text-gray-300">{fmt(e.beneficiaries)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Beneficiaries by Activity type (donut-style) ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> {t('benefByActivity')}
            </h4>
            {activityEntries.length === 0 ? (
              <p className="py-12 text-center text-xs text-gray-400">{t('noCampaignData')}</p>
            ) : (
              <div className="space-y-2">
                {activityEntries.map(([activity, count], idx) => {
                  const pct = Math.round((count / totalActivityBenef) * 100);
                  const color = ACTIVITY_COLORS[idx % ACTIVITY_COLORS.length];
                  return (
                    <div key={activity}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <span className="truncate text-[10px] text-gray-600 dark:text-gray-400" title={activity}>{activity}</span>
                        </div>
                        <span className="shrink-0 text-[10px] font-bold text-gray-800 dark:text-gray-200">{pct}%</span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  CHARTS ROW 2 — Activities included + Sector table         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {!isLoading && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* ── Projects that include the following activities ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" /> {t('activitiesIncluded')}
            </h4>
            <div className="space-y-1.5">
              {activityEntries.map(([activity, count], idx) => {
                const maxAct = activityEntries[0]?.[1] || 1;
                const pct = Math.round((count / maxAct) * 100);
                const color = ACTIVITY_COLORS[idx % ACTIVITY_COLORS.length];
                return (
                  <div key={activity} className="flex items-center gap-1.5">
                    <span className="w-44 shrink-0 truncate text-right text-[10px] font-medium text-gray-500" title={activity}>{activity}</span>
                    <div className="h-3.5 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-700">
                      <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    <span className="w-10 shrink-0 text-right text-[10px] font-bold text-gray-700 dark:text-gray-300">{count.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Sector summary table ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> {t('bySector')}
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-1.5 text-left font-semibold text-gray-500">{t('filterSector')}</th>
                    <th className="pb-1.5 text-right font-semibold text-gray-500">{t('beneficiariesReached')}</th>
                    <th className="pb-1.5 text-right font-semibold text-gray-500">{t('individualsTrained')}</th>
                    <th className="pb-1.5 text-right font-semibold text-gray-500">{t('totalProjects')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sectorEntries.map((e) => (
                    <tr key={e.sector} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SECTOR_COLORS[e.sector] ?? '#9E9E9E' }} />
                          <span className="text-gray-700 dark:text-gray-300">{e.sector}</span>
                        </div>
                      </td>
                      <td className="py-1.5 text-right font-semibold text-gray-900 dark:text-white">{fmt(e.beneficiaries)}</td>
                      <td className="py-1.5 text-right text-gray-500">{fmt(e.trained)}</td>
                      <td className="py-1.5 text-right text-gray-500">{e.projects.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  FOOTER BAR                                                */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-[10px] text-gray-400 dark:border-gray-700 dark:bg-gray-800/50">
        <p>
          <strong>Disclaimer:</strong> The beneficiary numbers are screen-level and the intergrated data of all
          country projects are a sum that may reflect enhanced contributions to the beneficiary totals. Data
          source: PAID quarterly submissions, AU-IBAR. Livestock interventions data cover all 55 AU member states.
        </p>
      </div>
    </div>
  );
}
