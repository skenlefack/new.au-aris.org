'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Activity,
  Beaker,
  Droplets,
  ShieldCheck,
  ShieldAlert,
  Thermometer,
  PackageX,
  BarChart3,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCampaignSubmissions } from '@/lib/api/workflow-hooks';
import type { CountryOutbreakData } from '@/components/dashboard/demo-data';
import { AFRICA_COUNTRIES } from '@/components/dashboard/maps/africa-geo-data';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';

/* Leaflet map — dynamic import (no SSR) */
const ChoroplethMap = dynamic(
  () => import('@/components/dashboard/maps/ChoroplethMap').then((m) => m.ChoroplethMap),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);

/* ── Pie chart ── */
function PieChart({ entries, colors, size = 160 }: {
  entries: { label: string; value: number }[];
  colors: string[];
  size?: number;
}) {
  const total = entries.reduce((s, e) => s + e.value, 0) || 1;
  let acc = 0;
  const stops = entries.map((e, i) => {
    const start = (acc / total) * 360;
    acc += e.value;
    const end = (acc / total) * 360;
    return `${colors[i % colors.length]} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
  });
  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0 rounded-full shadow-lg"
        style={{ width: size, height: size, background: entries.length > 0 ? `conic-gradient(${stops.join(', ')})` : '#e5e7eb' }} />
      <div className="space-y-2">
        {entries.map((e, i) => (
          <div key={e.label} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {e.label}: <strong>{e.value}</strong>
              <span className="ml-1 text-xs text-gray-400">({Math.round((e.value / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Donut chart ── */
function DonutChart({ entries, colors, size = 160, centerLabel }: {
  entries: { label: string; value: number }[];
  colors: string[];
  size?: number;
  centerLabel?: string;
}) {
  const total = entries.reduce((s, e) => s + e.value, 0) || 1;
  let acc = 0;
  const stops = entries.map((e, i) => {
    const start = (acc / total) * 360;
    acc += e.value;
    const end = (acc / total) * 360;
    return `${colors[i % colors.length]} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
  });
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0 rounded-full shadow-lg"
        style={{ width: size, height: size, background: entries.length > 0 ? `conic-gradient(${stops.join(', ')})` : '#e5e7eb' }}>
        <div className="absolute rounded-full bg-white dark:bg-gray-900 flex items-center justify-center" style={{ inset: size * 0.2 }}>
          {centerLabel && <span className="text-lg font-bold text-gray-700 dark:text-gray-200">{centerLabel}</span>}
        </div>
      </div>
      <div className="space-y-2">
        {entries.map((e, i) => (
          <div key={e.label} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {e.label}: <strong>{e.value}</strong>
              <span className="ml-1 text-xs text-gray-400">({Math.round((e.value / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Horizontal Bar chart ── */
function HBarChart({ entries, color = '#4C1D95', maxBarWidth = 320 }: {
  entries: { label: string; value: number }[];
  color?: string;
  maxBarWidth?: number;
}) {
  const maxVal = Math.max(...entries.map((e) => e.value), 1);
  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div key={e.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-right text-xs text-gray-600 dark:text-gray-400 truncate">{e.label}</span>
          <div className="flex-1 h-5 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden" style={{ maxWidth: maxBarWidth }}>
            <div className="h-full rounded transition-all" style={{ width: `${(e.value / maxVal) * 100}%`, backgroundColor: color }} />
          </div>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-10">{e.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Gauge chart ── */
function GaugeChart({ value, max, label, color = '#059669' }: {
  value: number;
  max: number;
  label: string;
  color?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const r = 60;
  const circ = Math.PI * r;
  const offset = circ - (circ * pct) / 100;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={140} height={80} viewBox="0 0 140 80">
        <path d="M 10 75 A 60 60 0 0 1 130 75" fill="none" stroke="#e5e7eb" strokeWidth={10} strokeLinecap="round" />
        <path d="M 10 75 A 60 60 0 0 1 130 75" fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${circ}`} strokeDashoffset={offset}
          className="transition-all duration-700" />
        <text x="70" y="65" textAnchor="middle" className="fill-gray-800 dark:fill-gray-200 text-lg font-bold" fontSize="20">{pct}%</text>
      </svg>
      <span className="text-xs text-gray-500 text-center">{label}</span>
    </div>
  );
}

/* ================================================================== */
/*  SeroSurveillanceDashboard                                          */
/* ================================================================== */

export default function SeroSurveillanceDashboard({ campaignId }: { campaignId: string }) {
  const t = useTranslations('collecte');
  const locale = useLocaleStore((s) => s.locale);
  // Fetch all submissions (multi-form campaign — forms A/B/C/D)
  const sQ = useCampaignSubmissions(campaignId, { limit: 2000 });
  const rawSubs: any[] = Array.isArray(sQ.data?.data) ? sQ.data.data : [];
  const loading = sQ.isLoading;

  const computed = useMemo(() => {
    // Separate submissions by form type (detected by key field presence)
    const formA: any[] = [];
    const formB: any[] = [];
    const formC: any[] = [];
    const formD: any[] = [];

    for (const sub of rawSubs) {
      const d = sub.data || {};
      if (d.accession_number || d.od_inhibition !== undefined || d.result) {
        formD.push(d);
      } else if (d.consignment_id || d.tubes_dispatched !== undefined) {
        formC.push(d);
      } else if (d.animal_identifier || d.species || d.dentition_category) {
        formB.push(d);
      } else {
        formA.push(d);
      }
    }

    // ── KPIs ──
    const totalHerds = formA.length;
    const totalAnimalsSampled = formA.reduce((s, d) => s + (parseInt(d.animals_sampled, 10) || 0), 0);
    const sheepSampled = formB.filter((d) => (d.species || '').toLowerCase().includes('sheep')).length;
    const goatsSampled = formB.filter((d) => (d.species || '').toLowerCase().includes('goat')).length;

    const totalResults = formD.filter((d) => d.result && d.result !== 'invalid').length;
    const positiveResults = formD.filter((d) => (d.result || '').toLowerCase() === 'positive').length;
    const seroPositiveRate = totalResults > 0 ? Math.round((positiveResults / totalResults) * 100 * 10) / 10 : 0;

    const totalSpecimens = formC.reduce((s, d) => s + (parseInt(d.specimens_received, 10) || 0) + (parseInt(d.specimens_rejected, 10) || 0), 0);
    const rejectedSpecimens = formC.reduce((s, d) => s + (parseInt(d.specimens_rejected, 10) || 0), 0);
    const rejectionRate = totalSpecimens > 0 ? Math.round((rejectedSpecimens / totalSpecimens) * 100 * 10) / 10 : 0;

    // ── Counties ──
    const countyMap = new Map<string, { herds: number; animals: number; positive: number; totalResults: number }>();
    for (const d of formA) {
      const loc = d.admin_location || {};
      const county = loc.admin1Name || loc.admin1 || 'Unknown';
      const entry = countyMap.get(county) || { herds: 0, animals: 0, positive: 0, totalResults: 0 };
      entry.herds += 1;
      entry.animals += parseInt(d.animals_sampled, 10) || 0;
      countyMap.set(county, entry);
    }
    // Try to link D results by herd via B→A chain
    const animalToCounty = new Map<string, string>();
    for (const d of formB) {
      const hid = d.herd_identifier || '';
      // find matching A record
      const matchA = formA.find((a) => a.herd_identifier === hid);
      if (matchA) {
        const loc = matchA.admin_location || {};
        const county = loc.admin1Name || loc.admin1 || 'Unknown';
        animalToCounty.set(d.animal_identifier || '', county);
      }
    }
    for (const d of formD) {
      const county = animalToCounty.get(d.animal_identifier_d || d.animal_identifier || '') || 'Unknown';
      const entry = countyMap.get(county) || { herds: 0, animals: 0, positive: 0, totalResults: 0 };
      if (d.result && d.result !== 'invalid') {
        entry.totalResults += 1;
        if ((d.result || '').toLowerCase() === 'positive') entry.positive += 1;
      }
      countyMap.set(county, entry);
    }

    const countyTable = Array.from(countyMap.entries())
      .map(([county, v]) => ({
        county,
        herds: v.herds,
        animals: v.animals,
        positive: v.positive,
        rate: v.totalResults > 0 ? Math.round((v.positive / v.totalResults) * 100 * 10) / 10 : 0,
      }))
      .filter((r) => r.county !== 'Unknown' || r.herds > 0)
      .sort((a, b) => b.herds - a.herds);

    // ── PPR Status pie (from Form D) ──
    const statusCounts = new Map<string, number>();
    for (const d of formD) {
      const r = (d.result || 'Unknown').charAt(0).toUpperCase() + (d.result || 'unknown').slice(1).toLowerCase();
      statusCounts.set(r, (statusCounts.get(r) || 0) + 1);
    }
    const pprStatusEntries = Array.from(statusCounts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    // ── Species distribution pie (from Form B) ──
    const speciesCounts = new Map<string, number>();
    for (const d of formB) {
      const sp = (d.species || 'Unknown').charAt(0).toUpperCase() + (d.species || 'unknown').slice(1).toLowerCase();
      speciesCounts.set(sp, (speciesCounts.get(sp) || 0) + 1);
    }
    const speciesEntries = Array.from(speciesCounts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    // ── Risk stratum pie (from Form A) ──
    const riskCounts = new Map<string, number>();
    for (const d of formA) {
      const r = (d.risk_stratum || 'unknown').charAt(0).toUpperCase() + (d.risk_stratum || 'unknown').slice(1).toLowerCase();
      riskCounts.set(r, (riskCounts.get(r) || 0) + 1);
    }
    const riskEntries = Array.from(riskCounts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    // ── Vaccination history vs serostatus cross-table ──
    const vaccCross = new Map<string, { positive: number; negative: number; doubtful: number; total: number }>();
    for (const d of formD) {
      const aid = d.animal_identifier_d || d.animal_identifier || '';
      const bRec = formB.find((b) => b.animal_identifier === aid);
      const vaccStatus = bRec ? (bRec.vaccination_status || 'unknown') : 'unknown';
      const label = vaccStatus.charAt(0).toUpperCase() + vaccStatus.slice(1).toLowerCase().replace(/_/g, ' ');
      const entry = vaccCross.get(label) || { positive: 0, negative: 0, doubtful: 0, total: 0 };
      entry.total += 1;
      const res = (d.result || '').toLowerCase();
      if (res === 'positive') entry.positive += 1;
      else if (res === 'negative') entry.negative += 1;
      else if (res === 'doubtful') entry.doubtful += 1;
      vaccCross.set(label, entry);
    }
    const vaccCrossTable = Array.from(vaccCross.entries())
      .map(([vaccStatus, v]) => ({ vaccStatus, ...v }))
      .sort((a, b) => b.total - a.total);

    // ── Samples per county (bar chart) ──
    const samplesByCounty = countyTable
      .map((c) => ({ label: c.county, value: c.animals }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);

    // ── Seroprevalence by age group ──
    const ageGroups = new Map<string, { positive: number; total: number }>();
    for (const d of formD) {
      const aid = d.animal_identifier_d || d.animal_identifier || '';
      const bRec = formB.find((b) => b.animal_identifier === aid);
      const ageMonths = bRec ? parseInt(bRec.age_months, 10) || 0 : 0;
      let ageGroup = '0-6m';
      if (ageMonths > 6 && ageMonths <= 12) ageGroup = '6-12m';
      else if (ageMonths > 12 && ageMonths <= 24) ageGroup = '12-24m';
      else if (ageMonths > 24 && ageMonths <= 48) ageGroup = '24-48m';
      else if (ageMonths > 48) ageGroup = '48m+';
      const entry = ageGroups.get(ageGroup) || { positive: 0, total: 0 };
      entry.total += 1;
      if ((d.result || '').toLowerCase() === 'positive') entry.positive += 1;
      ageGroups.set(ageGroup, entry);
    }
    const ageOrder = ['0-6m', '6-12m', '12-24m', '24-48m', '48m+'];
    const ageBarEntries = ageOrder
      .filter((k) => ageGroups.has(k))
      .map((k) => {
        const v = ageGroups.get(k)!;
        return { label: k, value: v.total > 0 ? Math.round((v.positive / v.total) * 100) : 0 };
      });

    // ── Chain of custody ──
    const totalDispatched = formC.reduce((s, d) =>
      s + (parseInt(d.tubes_dispatched, 10) || 0)
        + (parseInt(d.cryovials_dispatched, 10) || 0)
        + (parseInt(d.swabs_dispatched, 10) || 0), 0);
    const totalReceived = formC.reduce((s, d) => s + (parseInt(d.specimens_received, 10) || 0), 0);

    // Temperature compliance: count consignments where both temps are <= 8 (cold chain maintained)
    const consignmentsWithTemp = formC.filter((d) => d.temp_dispatch !== undefined && d.temp_receipt !== undefined);
    const compliantConsignments = consignmentsWithTemp.filter((d) => {
      const td = parseFloat(d.temp_dispatch) || 99;
      const tr = parseFloat(d.temp_receipt) || 99;
      return td <= 8 && tr <= 8;
    }).length;
    const tempCompliancePct = consignmentsWithTemp.length > 0
      ? Math.round((compliantConsignments / consignmentsWithTemp.length) * 100) : 0;

    // Rejection reasons breakdown
    const rejReasons = new Map<string, number>();
    for (const d of formC) {
      const reason = d.rejection_reasons || '';
      if (reason) {
        const label = reason.charAt(0).toUpperCase() + reason.slice(1).replace(/_/g, ' ');
        rejReasons.set(label, (rejReasons.get(label) || 0) + 1);
      }
    }
    const rejReasonsEntries = Array.from(rejReasons.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    // ── Map data ──
    // For Liberia: build map data from counties. We use country-level map with LR.
    const lrSubs = totalHerds;
    const mapData: CountryOutbreakData[] = [{
      code: 'LR', name: 'Liberia',
      outbreaks: positiveResults, cases: totalAnimalsSampled, deaths: 0,
      vaccinations: 0, submissions: lrSubs, rec: 'ECOWAS',
    }];

    return {
      kpis: { totalHerds, totalAnimalsSampled, sheepSampled, goatsSampled, seroPositiveRate, rejectionRate },
      countyTable,
      pprStatusEntries,
      speciesEntries,
      riskEntries,
      vaccCrossTable,
      samplesByCounty,
      ageBarEntries,
      chainOfCustody: { totalDispatched, totalReceived, tempCompliancePct, rejReasonsEntries },
      mapData,
      totalSubmissions: rawSubs.length,
      countyCount: countyTable.filter((c) => c.county !== 'Unknown').length,
    };
  }, [rawSubs]);

  const ACCENT = '#4C1D95';
  const RESULT_COLORS: Record<string, string> = {
    Positive: '#DC2626',
    Negative: '#059669',
    Doubtful: '#D97706',
    Invalid: '#9CA3AF',
    Unknown: '#6B7280',
  };

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-950">
      {/* HEADER */}
      <div className="flex items-center justify-between bg-[#4C1D95] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Beaker className="h-5 w-5 text-white/80" />
          <span className="text-sm font-bold tracking-wide text-white">
            {t('seroTitle')}
          </span>
        </div>
        <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">
          {computed.countyCount} {t('seroCounties')}
        </span>
      </div>

      {/* 6 KPI ROW */}
      <div className="grid grid-cols-2 md:grid-cols-6 divide-x divide-gray-200 border-b border-gray-300 bg-white dark:divide-gray-700 dark:bg-gray-900">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)
        ) : (
          [
            { icon: Activity, val: computed.kpis.totalHerds, label: t('seroHerdsSurveyed'), color: '#4C1D95', bg: '#F5F3FF' },
            { icon: Droplets, val: computed.kpis.totalAnimalsSampled, label: t('seroAnimalsSampled'), color: '#7C3AED', bg: '#F5F3FF' },
            { icon: Activity, val: computed.kpis.sheepSampled, label: t('seroSheepSampled'), color: '#EA580C', bg: '#FFF7ED' },
            { icon: Activity, val: computed.kpis.goatsSampled, label: t('seroGoatsSampled'), color: '#0891B2', bg: '#ECFEFF' },
            { icon: ShieldAlert, val: `${computed.kpis.seroPositiveRate}%`, label: t('seroPositiveRate'), color: '#DC2626', bg: '#FEF2F2' },
            { icon: PackageX, val: `${computed.kpis.rejectionRate}%`, label: t('seroRejectionRate'), color: '#D97706', bg: '#FFFBEB' },
          ].map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: k.bg }}>
                  <Icon className="h-5 w-5" style={{ color: k.color }} />
                </div>
                <div>
                  <p className="text-xl font-black md:text-2xl" style={{ color: k.color }}>{k.val}</p>
                  <p className="text-[10px] leading-tight text-gray-500">{k.label}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MAIN CONTENT */}
      {loading ? (
        <div className="grid flex-1 gap-4 p-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="min-h-[300px] rounded-xl" />)}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* ROW 1: Map + Pie charts */}
          <div className="grid gap-4 md:grid-cols-5">
            {/* Map — spans 3 */}
            <div className="md:col-span-3 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <BarChart3 className="h-4 w-4 text-[#4C1D95]" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">{t('seroMapTitle')}</h3>
              </div>
              <div className="relative h-[480px]">
                <ChoroplethMap title="" data={computed.mapData} indicator="submissions" bare />
                {/* County seroprevalence legend */}
                <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-white/95 px-3 py-2.5 shadow-md backdrop-blur dark:bg-gray-900/95">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('seroCountySummary')}</p>
                  {computed.countyTable.slice(0, 5).map((c) => (
                    <div key={c.county} className="flex items-center gap-2 py-0.5">
                      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: c.rate > 30 ? '#DC2626' : c.rate > 15 ? '#D97706' : '#059669' }} />
                      <span className="text-[11px] text-gray-600 dark:text-gray-300">{c.county}: {c.rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right — 3 pie charts */}
            <div className="md:col-span-2 space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">{t('seroStatusDistribution')}</h3>
                {computed.pprStatusEntries.length > 0 ? (
                  <PieChart
                    entries={computed.pprStatusEntries}
                    colors={computed.pprStatusEntries.map((e) => RESULT_COLORS[e.label] || '#9CA3AF')}
                    size={140}
                  />
                ) : (
                  <p className="text-sm text-gray-400 italic">{t('noData')}</p>
                )}
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">{t('seroSpeciesDistribution')}</h3>
                {computed.speciesEntries.length > 0 ? (
                  <PieChart entries={computed.speciesEntries} colors={['#EA580C', '#0891B2', '#7C3AED', '#059669']} size={140} />
                ) : (
                  <p className="text-sm text-gray-400 italic">{t('noData')}</p>
                )}
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">{t('seroRiskDistribution')}</h3>
                {computed.riskEntries.length > 0 ? (
                  <PieChart entries={computed.riskEntries} colors={['#DC2626', '#D97706', '#059669', '#9CA3AF']} size={140} />
                ) : (
                  <p className="text-sm text-gray-400 italic">{t('noData')}</p>
                )}
              </div>
            </div>
          </div>

          {/* ROW 2: Tables */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* County summary table */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <BarChart3 className="h-4 w-4 text-[#4C1D95]" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">{t('seroCountySummary')} ({computed.countyTable.length})</h3>
              </div>
              <div className="overflow-auto max-h-[360px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                    <tr className="text-[11px] uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-2 text-left font-semibold">{t('seroColCounty')}</th>
                      <th className="px-4 py-2 text-right font-semibold">{t('seroColHerds')}</th>
                      <th className="px-4 py-2 text-right font-semibold">{t('seroColAnimals')}</th>
                      <th className="px-4 py-2 text-right font-semibold">{t('seroColPositive')}</th>
                      <th className="px-4 py-2 text-right font-semibold">{t('seroColRate')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {computed.countyTable.map((r) => (
                      <tr key={r.county} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: r.rate > 30 ? '#DC2626' : r.rate > 15 ? '#D97706' : '#059669' }} />
                            {r.county}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">{r.herds}</td>
                        <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">{r.animals}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800 dark:text-gray-200">{r.positive}</td>
                        <td className="px-4 py-2 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.rate > 30 ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                              : r.rate > 15 ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                                : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          }`}>
                            {r.rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {computed.countyTable.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 italic">{t('noData')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vaccination history vs serostatus */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">{t('seroVaccHistoryVsStatus')}</h3>
              </div>
              <div className="overflow-auto max-h-[360px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                    <tr className="text-[11px] uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-2 text-left font-semibold">{t('seroColVaccStatus')}</th>
                      <th className="px-4 py-2 text-right font-semibold text-red-600">{t('seroColPositive')}</th>
                      <th className="px-4 py-2 text-right font-semibold text-green-600">{t('seroColNegative')}</th>
                      <th className="px-4 py-2 text-right font-semibold text-yellow-600">{t('seroColDoubtful')}</th>
                      <th className="px-4 py-2 text-right font-semibold">{t('seroColTotal')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {computed.vaccCrossTable.map((r) => (
                      <tr key={r.vaccStatus} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{r.vaccStatus}</td>
                        <td className="px-4 py-2 text-right text-red-600 font-semibold">{r.positive}</td>
                        <td className="px-4 py-2 text-right text-green-600">{r.negative}</td>
                        <td className="px-4 py-2 text-right text-yellow-600">{r.doubtful}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800 dark:text-gray-200">{r.total}</td>
                      </tr>
                    ))}
                    {computed.vaccCrossTable.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 italic">{t('noData')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ROW 3: Bar charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">{t('seroSamplesByCounty')}</h3>
              {computed.samplesByCounty.length > 0 ? (
                <HBarChart entries={computed.samplesByCounty} color={ACCENT} />
              ) : (
                <p className="text-sm text-gray-400 italic">{t('noData')}</p>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">{t('seroPrevalenceByAge')}</h3>
              {computed.ageBarEntries.length > 0 ? (
                <HBarChart entries={computed.ageBarEntries} color="#DC2626" />
              ) : (
                <p className="text-sm text-gray-400 italic">{t('noData')}</p>
              )}
            </div>
          </div>

          {/* ROW 4: Chain of custody */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">{t('seroSpecimensDispatchedReceived')}</h3>
              <DonutChart
                entries={[
                  { label: t('seroDispatched'), value: computed.chainOfCustody.totalDispatched },
                  { label: t('seroReceived'), value: computed.chainOfCustody.totalReceived },
                ]}
                colors={['#4C1D95', '#059669']}
                size={140}
                centerLabel={`${computed.chainOfCustody.totalReceived}`}
              />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 flex flex-col items-center justify-center">
              <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">{t('seroTempCompliance')}</h3>
              <GaugeChart
                value={computed.chainOfCustody.tempCompliancePct}
                max={100}
                label={t('seroTempComplianceLabel')}
                color={computed.chainOfCustody.tempCompliancePct >= 90 ? '#059669' : computed.chainOfCustody.tempCompliancePct >= 70 ? '#D97706' : '#DC2626'}
              />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">{t('seroRejectionReasons')}</h3>
              {computed.chainOfCustody.rejReasonsEntries.length > 0 ? (
                <PieChart
                  entries={computed.chainOfCustody.rejReasonsEntries}
                  colors={['#DC2626', '#D97706', '#EA580C', '#7C3AED', '#0891B2', '#059669']}
                  size={130}
                />
              ) : (
                <p className="text-sm text-gray-400 italic">{t('noData')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="bg-[#4C1D95] px-4 py-1.5 text-[9px] leading-snug text-white/90">
        <strong>Source:</strong> {t('seroTitle')} — AU-IBAR. {t('dataSourceFooter', { count: computed.totalSubmissions })}
      </div>
    </div>
  );
}
