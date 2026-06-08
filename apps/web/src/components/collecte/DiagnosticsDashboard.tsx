'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Globe2,
  FlaskConical,
  Package,
  ShieldAlert,
  ShieldCheck,
  Handshake,
  Thermometer,
  Bell,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCampaignSubmissions } from '@/lib/api/workflow-hooks';
import type { CountryOutbreakData } from '@/components/dashboard/demo-data';
import { AFRICA_COUNTRIES } from '@/components/dashboard/maps/africa-geo-data';

/* Leaflet map — dynamic import (no SSR) */
const ChoroplethMap = dynamic(
  () => import('@/components/dashboard/maps/ChoroplethMap').then((m) => m.ChoroplethMap),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);

/* ── Country name → ISO2 mapping ── */
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {};
for (const c of AFRICA_COUNTRIES) {
  COUNTRY_NAME_TO_ISO2[c.name.toLowerCase()] = c.code;
  COUNTRY_NAME_TO_ISO2[c.nameFr.toLowerCase()] = c.code;
}
const EXTRA: Record<string, string> = {
  'ivory coast': 'CI', "cote d'ivoire": 'CI', 'democratic republic of the congo': 'CD',
  'dr congo': 'CD', 'drc': 'CD', 'republic of the congo': 'CG', 'congo brazzaville': 'CG',
  'south africa': 'ZA', 'south sudan': 'SS', 'burkina': 'BF', 'tanzania': 'TZ',
  'united republic of tanzania': 'TZ', 'central african republic': 'CF',
  'equatorial guinea': 'GQ', 'guinea-bissau': 'GW', 'guinea bissau': 'GW',
  'sierra leone': 'SL', 'cabo verde': 'CV', 'cape verde': 'CV',
  'sao tome and principe': 'ST', 'são tomé': 'ST', 'sao tome': 'ST',
  'eswatini': 'SZ', 'swaziland': 'SZ', 'mauritius': 'MU',
  'seychelles': 'SC', 'comoros': 'KM', 'lesotho': 'LS',
  'kenya': 'KE', 'ethiopia': 'ET', 'nigeria': 'NG', 'senegal': 'SN',
  'ghana': 'GH', 'cameroon': 'CM', 'cameroun': 'CM', 'chad': 'TD', 'tchad': 'TD',
  'niger': 'NE', 'mali': 'ML', 'benin': 'BJ', 'bénin': 'BJ', 'togo': 'TG',
  'uganda': 'UG', 'ouganda': 'UG', 'rwanda': 'RW', 'burundi': 'BI',
  'mozambique': 'MZ', 'zambia': 'ZM', 'zambie': 'ZM', 'zimbabwe': 'ZW',
  'malawi': 'MW', 'madagascar': 'MG', 'angola': 'AO', 'namibia': 'NA', 'namibie': 'NA',
  'botswana': 'BW', 'gabon': 'GA', 'congo': 'CG', 'liberia': 'LR', 'libéria': 'LR',
  'gambia': 'GM', 'gambie': 'GM', 'mauritania': 'MR', 'mauritanie': 'MR',
  'morocco': 'MA', 'maroc': 'MA', 'algeria': 'DZ', 'algérie': 'DZ',
  'tunisia': 'TN', 'tunisie': 'TN', 'libya': 'LY', 'libye': 'LY',
  'egypt': 'EG', 'égypte': 'EG', 'sudan': 'SD', 'soudan': 'SD',
  'somalia': 'SO', 'somalie': 'SO', 'djibouti': 'DJ', 'eritrea': 'ER', 'érythrée': 'ER',
};
Object.assign(COUNTRY_NAME_TO_ISO2, EXTRA);

function resolveCountryCode(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/[^a-zà-ÿ\s'-]/g, '');
  if (cleaned.length === 2) {
    const upper = cleaned.toUpperCase();
    if (AFRICA_COUNTRIES.some((c) => c.code === upper)) return upper;
  }
  return COUNTRY_NAME_TO_ISO2[cleaned] ?? null;
}

function countryName(code: string): string {
  const c = AFRICA_COUNTRIES.find((x) => x.code === code);
  return c?.nameFr || c?.name || code;
}

type PprStatus = 'Infected' | 'Free' | 'Eradicated' | 'Other';

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
function HBarChart({ entries, color = '#7C3AED', maxBarWidth = 320 }: {
  entries: { label: string; value: number }[];
  color?: string;
  maxBarWidth?: number;
}) {
  const maxVal = Math.max(...entries.map((e) => e.value), 1);
  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div key={e.label} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-right text-xs text-gray-600 dark:text-gray-400 truncate">{e.label}</span>
          <div className="flex-1 h-5 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden" style={{ maxWidth: maxBarWidth }}>
            <div className="h-full rounded transition-all" style={{ width: `${(e.value / maxVal) * 100}%`, backgroundColor: color }} />
          </div>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-10">{e.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  DiagnosticsDashboard                                               */
/* ================================================================== */

const PPR_STATUS_COLORS: Record<string, string> = {
  Infected: '#DC2626',
  Free: '#059669',
  Eradicated: '#1E40AF',
  Other: '#9CA3AF',
};

export default function DiagnosticsDashboard({ campaignId }: { campaignId: string }) {
  const sQ = useCampaignSubmissions(campaignId, { limit: 5000 });
  const rawSubs: any[] = Array.isArray(sQ.data?.data) ? sQ.data.data : [];
  const loading = sQ.isLoading;

  const {
    kpis,
    mapData,
    pprStatusEntries,
    pmatEntries,
    testEntries,
    infectedTable,
    storageTable,
    kitsBarEntries,
    notifEntries,
    allCountriesStatus,
  } = useMemo(() => {
    interface SubRow {
      code: string;
      pprStatus: string;
      pmatStage: number;
      diagnosticTests: string;
      kitsRequested: number;
      notificationSystem: string;
      storageConditions: string;
      endorsement: string;
      commitment: string;
    }

    const rows: SubRow[] = [];
    const countrySet = new Set<string>();

    for (const sub of rawSubs) {
      const d = sub.data || {};
      const rawCountry = d.country || '';
      const code = resolveCountryCode(rawCountry);
      if (!code) continue;
      if (!AFRICA_COUNTRIES.some((c) => c.code === code)) continue;
      countrySet.add(code);
      rows.push({
        code,
        pprStatus: (d.ppr_status || 'Other').trim(),
        pmatStage: parseInt(d.pmat_stage, 10) || 0,
        diagnosticTests: (d.diagnostic_tests || '').trim(),
        kitsRequested: parseInt(d.kits_requested, 10) || 0,
        notificationSystem: (d.notification_system || '').trim(),
        storageConditions: (d.storage_conditions || '').trim(),
        endorsement: (d.endorsement || '').trim().toLowerCase(),
        commitment: (d.commitment || '').trim().toLowerCase(),
      });
    }

    /* KPIs */
    const totalCountries = countrySet.size;
    const totalKits = rows.reduce((s, r) => s + r.kitsRequested, 0);
    const infectedCountries = new Set(rows.filter((r) => r.pprStatus === 'Infected').map((r) => r.code)).size;
    const freeCountries = new Set(rows.filter((r) => r.pprStatus.toLowerCase().includes('free')).map((r) => r.code)).size;
    const commitYes = rows.filter((r) => r.commitment === 'yes').length;
    const engagementRate = rows.length > 0 ? Math.round((commitYes / rows.length) * 100) : 0;

    /* PPR Status distribution */
    const statusMap = new Map<string, number>();
    for (const r of rows) {
      const key = r.pprStatus || 'Other';
      statusMap.set(key, (statusMap.get(key) || 0) + 1);
    }
    const pprStatusEntries = Array.from(statusMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

    /* PMAT Stage distribution */
    const pmatMap = new Map<string, number>();
    for (const r of rows) {
      if (r.pmatStage >= 1 && r.pmatStage <= 4) {
        const key = `Stade ${r.pmatStage}`;
        pmatMap.set(key, (pmatMap.get(key) || 0) + 1);
      }
    }
    const pmatEntries = Array.from(pmatMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label));

    /* Diagnostic tests distribution */
    const testMap = new Map<string, number>();
    for (const r of rows) {
      if (r.diagnosticTests) {
        testMap.set(r.diagnosticTests, (testMap.get(r.diagnosticTests) || 0) + 1);
      }
    }
    const testEntries = Array.from(testMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

    /* Notification system distribution */
    const notifMap = new Map<string, number>();
    for (const r of rows) {
      if (r.notificationSystem) {
        notifMap.set(r.notificationSystem, (notifMap.get(r.notificationSystem) || 0) + 1);
      }
    }
    const notifEntries = Array.from(notifMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

    /* Infected table */
    const infectedTable = rows
      .filter((r) => r.pprStatus === 'Infected')
      .map((r) => ({ country: countryName(r.code), code: r.code, pprStatus: r.pprStatus, kitsRequested: r.kitsRequested, pmatStage: r.pmatStage }))
      .sort((a, b) => a.country.localeCompare(b.country));

    /* Storage & engagement table */
    const storageTable = rows
      .map((r) => ({ country: countryName(r.code), code: r.code, storageConditions: r.storageConditions, endorsement: r.endorsement, commitment: r.commitment }))
      .sort((a, b) => a.country.localeCompare(b.country));

    /* Kits per country (bar chart) */
    const kitsPerCountry = new Map<string, number>();
    for (const r of rows) {
      kitsPerCountry.set(r.code, (kitsPerCountry.get(r.code) || 0) + r.kitsRequested);
    }
    const kitsBarEntries = Array.from(kitsPerCountry.entries())
      .map(([code, value]) => ({ label: countryName(code), value }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);

    /* Map data — color by PPR status (outbreaks field used for coloring) */
    const countryStatusMap = new Map<string, string>();
    for (const r of rows) {
      countryStatusMap.set(r.code, r.pprStatus);
    }
    const md: CountryOutbreakData[] = rows.map((r) => ({
      code: r.code, name: countryName(r.code),
      outbreaks: r.pprStatus === 'Infected' ? 10 : r.pprStatus.toLowerCase().includes('free') ? 0 : 1,
      cases: r.kitsRequested, deaths: 0, vaccinations: 0, submissions: 1, rec: '',
    }));

    /* All countries status for map legend */
    const statusByCountry = new Map<string, string>();
    for (const r of rows) statusByCountry.set(r.code, r.pprStatus);
    const allCountriesStatus = AFRICA_COUNTRIES.map((c) => ({
      ...c,
      pprStatus: statusByCountry.get(c.code) ?? 'not_surveyed',
    }));

    return {
      kpis: { totalCountries, totalKits, infectedCountries, freeCountries, engagementRate },
      mapData: md,
      pprStatusEntries,
      pmatEntries,
      testEntries,
      infectedTable,
      storageTable,
      kitsBarEntries,
      notifEntries,
      allCountriesStatus,
    };
  }, [rawSubs]);

  const ACCENT = '#7C3AED';

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-950">
      {/* HEADER */}
      <div className="flex items-center justify-between bg-[#7C3AED] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-white/80" />
          <span className="text-sm font-bold tracking-wide text-white">
            Programme PPR — Capacit&eacute; Diagnostique &amp; Kits HPPR-bELISA
          </span>
        </div>
        <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">
          {kpis.totalCountries} pays
        </span>
      </div>

      {/* 5 KPI ROW */}
      <div className="grid grid-cols-5 divide-x divide-gray-200 border-b border-gray-300 bg-white dark:divide-gray-700 dark:bg-gray-900">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)
        ) : (
          [
            { icon: Globe2, val: kpis.totalCountries, label: 'Pays enqu\u00EAt\u00E9s', color: '#7C3AED', bg: '#F5F3FF' },
            { icon: Package, val: kpis.totalKits, label: 'Kits demand\u00E9s', color: '#EA580C', bg: '#FFF7ED' },
            { icon: ShieldAlert, val: kpis.infectedCountries, label: 'Pays infect\u00E9s', color: '#DC2626', bg: '#FEF2F2' },
            { icon: ShieldCheck, val: kpis.freeCountries, label: 'Pays indemnes', color: '#059669', bg: '#ECFDF5' },
            { icon: Handshake, val: `${kpis.engagementRate}%`, label: "Taux d'engagement", color: '#1E40AF', bg: '#EFF6FF' },
          ].map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: k.bg }}>
                  <Icon className="h-5 w-5" style={{ color: k.color }} />
                </div>
                <div>
                  <p className="text-2xl font-black" style={{ color: k.color }}>{k.val}</p>
                  <p className="text-[10px] leading-tight text-gray-500">{k.label}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MAIN CONTENT */}
      {loading ? (
        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="min-h-[300px] rounded-xl" />)}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* ROW 1: Map + Charts */}
          <div className="grid gap-4 lg:grid-cols-5">
            {/* Africa Map — spans 3 */}
            <div className="lg:col-span-3 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <Globe2 className="h-4 w-4 text-[#7C3AED]" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Carte PPR en Afrique</h3>
              </div>
              <div className="relative h-[480px]">
                <ChoroplethMap title="" data={mapData} indicator="submissions" bare />
                <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-white/95 px-3 py-2.5 shadow-md backdrop-blur dark:bg-gray-900/95">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Statut PPR</p>
                  {[
                    { label: 'Infect\u00E9', color: '#DC2626' },
                    { label: 'Indemne', color: '#059669' },
                    { label: '\u00C9radiqu\u00E9', color: '#1E40AF' },
                    { label: 'Non enqu\u00EAt\u00E9', color: '#D1D5DB' },
                  ].map((s) => {
                    const count = s.label === 'Non enqu\u00EAt\u00E9'
                      ? allCountriesStatus.filter((c) => c.pprStatus === 'not_surveyed').length
                      : s.label === 'Infect\u00E9'
                        ? allCountriesStatus.filter((c) => c.pprStatus === 'Infected').length
                        : s.label === 'Indemne'
                          ? allCountriesStatus.filter((c) => c.pprStatus.toLowerCase().includes('free')).length
                          : allCountriesStatus.filter((c) => c.pprStatus === 'Eradicated').length;
                    return (
                      <div key={s.label} className="flex items-center gap-2 py-0.5">
                        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
                        <span className="text-[11px] text-gray-600 dark:text-gray-300">{s.label} ({count})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right — 3 charts */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">Statut PPR par Pays</h3>
                <PieChart
                  entries={pprStatusEntries}
                  colors={pprStatusEntries.map((e) => PPR_STATUS_COLORS[e.label] || '#9CA3AF')}
                  size={140}
                />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">Stade PMAT</h3>
                <PieChart entries={pmatEntries} colors={['#7C3AED', '#A78BFA', '#C4B5FD', '#DDD6FE']} size={140} />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">Tests Diagnostiques Utilis&eacute;s</h3>
                <DonutChart
                  entries={testEntries}
                  colors={['#1E40AF', '#059669', '#EA580C', '#DC2626', '#D97706', '#0891B2', '#7C3AED', '#4F46E5']}
                  size={140}
                  centerLabel={`${testEntries.length}`}
                />
              </div>
            </div>
          </div>

          {/* ROW 2: Tables */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Infected countries & kits */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <ShieldAlert className="h-4 w-4 text-red-600" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Pays infect&eacute;s &amp; Kits demand&eacute;s ({infectedTable.length})</h3>
              </div>
              <div className="overflow-auto max-h-[360px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                    <tr className="text-[11px] uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-2 text-left font-semibold">Pays</th>
                      <th className="px-4 py-2 text-left font-semibold">Statut PPR</th>
                      <th className="px-4 py-2 text-right font-semibold">Kits</th>
                      <th className="px-4 py-2 text-center font-semibold">PMAT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {infectedTable.map((r) => (
                      <tr key={r.code} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">
                          <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-red-500" />{r.country}</div>
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{r.pprStatus}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800 dark:text-gray-200">{r.kitsRequested}</td>
                        <td className="px-4 py-2 text-center">
                          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                            {r.pmatStage > 0 ? `Stade ${r.pmatStage}` : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {infectedTable.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400 italic">Aucune donn&eacute;e</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Storage & engagement */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <Thermometer className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Conditions de stockage &amp; Engagement ({storageTable.length})</h3>
              </div>
              <div className="overflow-auto max-h-[360px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                    <tr className="text-[11px] uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-2 text-left font-semibold">Pays</th>
                      <th className="px-4 py-2 text-left font-semibold">Stockage</th>
                      <th className="px-4 py-2 text-center font-semibold">Endorsement</th>
                      <th className="px-4 py-2 text-center font-semibold">Engagement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {storageTable.map((r, idx) => (
                      <tr key={`${r.code}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">
                          <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-blue-500" />{r.country}</div>
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{r.storageConditions || '—'}</td>
                        <td className="px-4 py-2 text-center">
                          {r.endorsement === 'yes'
                            ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">Oui</span>
                            : <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">Non</span>}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {r.commitment === 'yes'
                            ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">Oui</span>
                            : <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">Non</span>}
                        </td>
                      </tr>
                    ))}
                    {storageTable.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400 italic">Aucune donn&eacute;e</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ROW 3: Bar chart + Notification pie */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">Kits demand&eacute;s par pays</h3>
              {kitsBarEntries.length > 0 ? (
                <HBarChart entries={kitsBarEntries} color={ACCENT} />
              ) : (
                <p className="text-sm text-gray-400 italic">Aucune donn&eacute;e</p>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">Syst&egrave;mes de notification</h3>
              {notifEntries.length > 0 ? (
                <PieChart entries={notifEntries} colors={['#1E40AF', '#059669', '#EA580C', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#4F46E5']} size={140} />
              ) : (
                <p className="text-sm text-gray-400 italic">Aucune donn&eacute;e</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="bg-[#7C3AED] px-4 py-1.5 text-[9px] leading-snug text-white/90">
        <strong>Source :</strong> Enqu&ecirc;te &laquo; Tests Diagnostiques &amp; Kits HPPR-bELISA &raquo; —
        Programme PPR, AU-IBAR. Donn&eacute;es issues de {kpis.totalCountries} r&eacute;ponses pays.
      </div>
    </div>
  );
}
