'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import {
  Globe2, Bug, ShieldAlert, Syringe, FileText, Calendar, TrendingUp, BarChart3,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { analyticsClient } from '@/lib/api/client';
import { AFRICA_COUNTRIES } from '@/components/dashboard/maps/africa-geo-data';
import type { CountryOutbreakData } from '@/components/dashboard/demo-data';

const ChoroplethMap = dynamic(
  () => import('@/components/dashboard/maps/ChoroplethMap').then((m) => m.ChoroplethMap),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);

/* ── Country name → ISO2 ── */
const NAME_TO_ISO2: Record<string, string> = {};
for (const c of AFRICA_COUNTRIES) {
  NAME_TO_ISO2[c.name.toLowerCase()] = c.code;
  NAME_TO_ISO2[c.nameFr.toLowerCase()] = c.code;
}
const EXTRA: Record<string, string> = {
  'south africa': 'ZA', 'dr congo': 'CD', 'drc': 'CD', 'ivory coast': 'CI',
  "cote d'ivoire": 'CI', "cote d'ivoire": 'CI', 'eswatini': 'SZ', 'swaziland': 'SZ',
  'tanzania': 'TZ', 'congo brazaville': 'CG', 'congo': 'CG',
  'the gambia': 'GM', 'gambia': 'GM', 'guinea conakry': 'GN', 'guinee conakry': 'GN',
  'guinea': 'GN', 'guinea-bissau': 'GW', 'chad': 'TD', 'tchad': 'TD',
  'south sudan': 'SS', 'cape verde': 'CV', 'central african republic': 'CF',
  'equatorial guinea': 'GQ', 'sierra leone': 'SL', 'burkina faso': 'BF',
  'sao tome and principe': 'ST', 'lesotho': 'LS', 'namibia': 'NA',
  'mozambique': 'MZ', 'botswana': 'BW', 'zambia': 'ZM', 'zimbabwe': 'ZW',
  'kenya': 'KE', 'ethiopia': 'ET', 'nigeria': 'NG', 'ghana': 'GH',
  'benin': 'BJ', 'cameroon': 'CM', 'senegal': 'SN', 'mali': 'ML',
  'niger': 'NE', 'togo': 'TG', 'uganda': 'UG', 'burundi': 'BI',
  'gabon': 'GA', 'somalia': 'SO', 'sudan': 'SD', 'tunisia': 'TN',
  'madagascar': 'MG', 'djibouti': 'DJ', 'angola': 'AO', 'rwanda': 'RW',
  'mauritania': 'MR', 'malawi': 'MW', 'liberia': 'LR', 'libya': 'LY',
  'morocco': 'MA', 'algeria': 'DZ', 'egypt': 'EG', 'eritrea': 'ER',
  'mauritius': 'MU', 'seychelles': 'SC', 'comoros': 'KM',
};
Object.assign(NAME_TO_ISO2, EXTRA);

function toIso2(name: string): string | null {
  if (!name) return null;
  const k = name.trim().toLowerCase();
  return NAME_TO_ISO2[k] ?? (k.length === 2 ? k.toUpperCase() : null);
}

/* ── Colors ── */
const COLORS = ['#1F4E79', '#059669', '#EA580C', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#4F46E5', '#BE185D', '#65A30D', '#0D9488', '#6D28D9'];

/* ── Hook ── */
function useCampaignStats(campaignId: string) {
  return useQuery({
    queryKey: ['campaign-stats', campaignId],
    queryFn: async () => {
      const res = await analyticsClient.get<any>(`/analytics/campaigns/${campaignId}/stats`);
      return res?.data ?? res;
    },
    staleTime: 2 * 60 * 1000,
  });
}

/* ── KPI Card ── */
function Kpi({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  const formatted = typeof value === 'number' ? value.toLocaleString() : value;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}14`, color }}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{formatted}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}

/* ── Horizontal Bar Chart ── */
function HBar({ data, title, color }: { data: { name: string; value: number }[]; title: string; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      <div className="space-y-2.5">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-3">
            <span className="w-28 truncate text-xs text-gray-600 dark:text-gray-400" title={d.name}>{d.name}</span>
            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden dark:bg-gray-700">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color ?? COLORS[i % COLORS.length] }}
              />
            </div>
            <span className="w-14 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">{d.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Pie/Donut Chart (CSS only) ── */
function DonutChart({ data, title }: { data: { name: string; value: number }[]; title: string }) {
  if (!data.length) return null;
  const total = data.reduce((s, d) => s + d.value, 0);
  let accumulated = 0;
  const segments = data.map((d, i) => {
    const pct = (d.value / total) * 100;
    const start = accumulated;
    accumulated += pct;
    return { ...d, pct, start, color: COLORS[i % COLORS.length] };
  });
  const gradient = segments.map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(', ');

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      <div className="flex items-center gap-6">
        <div className="relative h-32 w-32 shrink-0">
          <div
            className="h-full w-full rounded-full"
            style={{ background: `conic-gradient(${gradient})` }}
          />
          <div className="absolute inset-3 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center">
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{total.toLocaleString()}</span>
          </div>
        </div>
        <div className="space-y-1.5 flex-1 min-w-0">
          {segments.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{s.name}</span>
              <span className="ml-auto text-xs font-semibold text-gray-700 dark:text-gray-300 shrink-0">{s.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Year Trend Chart (histogram + line curve) ── */
function YearTrend({ data }: { data: { year: number; reports: number; outbreaks: number }[] }) {
  if (!data.length) return null;
  const filtered = data.filter((d) => d.year >= 2007 && d.year <= 2025);
  const maxReports = Math.max(...filtered.map((d) => d.reports), 1);
  const maxOutbreaks = Math.max(...filtered.map((d) => d.outbreaks), 1);

  // SVG line path for outbreaks curve
  const chartH = 160;
  const chartW = filtered.length * 40;
  const points = filtered.map((d, i) => {
    const x = (i / (filtered.length - 1)) * 100;
    const y = 100 - (d.outbreaks / maxOutbreaks) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-gray-400" />
        Rapports et foyers par année
      </h3>
      <div className="relative" style={{ height: chartH }}>
        {/* Bars (reports) */}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {filtered.map((d) => (
            <div key={d.year} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full rounded-t bg-[#1F4E79]/70 hover:bg-[#1F4E79] transition-colors relative group"
                style={{ height: `${(d.reports / maxReports) * 100}%`, minHeight: 2 }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                  {d.reports.toLocaleString()} rapports
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Line curve (outbreaks) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            points={points}
            fill="none"
            stroke="#DC2626"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {filtered.map((d, i) => {
            const x = (i / (filtered.length - 1)) * 100;
            const y = 100 - (d.outbreaks / maxOutbreaks) * 100;
            return (
              <circle key={d.year} cx={x} cy={y} r="1.5" fill="#DC2626" vectorEffect="non-scaling-stroke" />
            );
          })}
        </svg>
      </div>
      {/* Year labels */}
      <div className="flex gap-[2px] mt-1">
        {filtered.map((d) => (
          <div key={d.year} className="flex-1 text-center text-[9px] text-gray-400">
            {String(d.year).slice(2)}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="mt-3 flex items-center gap-5 text-[10px] text-gray-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#1F4E79]/70" /> Rapports</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#DC2626] rounded" /> Foyers déclarés</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function HistoricalHealthDashboard({ campaignId }: { campaignId: string }) {
  const { data, isLoading } = useCampaignStats(campaignId);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  if (!data || !data.kpis) {
    return <p className="text-sm text-gray-400 text-center py-8">Aucune donnée disponible</p>;
  }

  const { kpis, diseaseDistribution, countryDistribution, yearlyTrend, outbreakStatus, outbreakType, countryMapData } = data;

  // Build map data — ChoroplethMap expects { code, name, outbreaks, cases, deaths, vaccinations, submissions, rec }
  const mapData: CountryOutbreakData[] = (countryMapData ?? []).map((c: any) => {
    const name = c.country ?? c.name;
    const iso = toIso2(name);
    if (!iso) return null;
    return { code: iso, name, outbreaks: c.value, cases: 0, deaths: 0, vaccinations: 0, submissions: c.value, rec: '' } as CountryOutbreakData;
  }).filter(Boolean) as CountryOutbreakData[];

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={FileText} label="Rapports sanitaires" value={kpis.totalReports} color="#1F4E79" />
        <Kpi icon={Globe2} label="Pays rapporteurs" value={kpis.countries} color="#059669" />
        <Kpi icon={Bug} label="Maladies surveillées" value={kpis.diseases} color="#7C3AED" />
        <Kpi icon={ShieldAlert} label="Total foyers déclarés" value={kpis.totalOutbreaks} color="#DC2626" />
        <Kpi icon={BarChart3} label="Rapports avec foyer" value={kpis.reportsWithOutbreak} color="#EA580C" />
        <Kpi icon={Syringe} label="Rapports avec vaccination" value={kpis.reportsWithVaccination} color="#0891B2" />
        <Kpi icon={Calendar} label="Date début" value={kpis.earliestDate ? new Date(kpis.earliestDate).toLocaleDateString('fr') : '-'} color="#6D28D9" />
        <Kpi icon={Calendar} label="Date fin" value={kpis.latestDate ? new Date(kpis.latestDate).toLocaleDateString('fr') : '-'} color="#6D28D9" />
      </div>

      {/* Map + Country distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-gray-400" /> Couverture géographique
            </h3>
          </div>
          <div className="h-[350px]">
            {mapData.length > 0 ? (
              <ChoroplethMap title="Couverture géographique" data={mapData} indicator="submissions" bare />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">Carte non disponible</div>
            )}
          </div>
        </div>
        <HBar data={countryDistribution ?? []} title="Top 15 pays — Nombre de rapports" color="#1F4E79" />
      </div>

      {/* Disease distribution + Yearly trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        <HBar data={diseaseDistribution ?? []} title="Top 12 maladies — Nombre de rapports" color="#DC2626" />
        <YearTrend data={yearlyTrend ?? []} />
      </div>

      {/* Outbreak status + Type */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DonutChart data={outbreakStatus ?? []} title="Statut des foyers" />
        <DonutChart data={outbreakType ?? []} title="Nouveaux vs Suivi" />
      </div>
    </div>
  );
}
