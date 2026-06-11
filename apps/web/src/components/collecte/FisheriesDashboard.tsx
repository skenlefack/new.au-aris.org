'use client';

import React, { useMemo } from 'react';
import {
  Fish,
  Ship,
  Factory,
  Waves,
  Anchor,
  ArrowLeftRight,
  Globe2,
  BarChart3,
  Users,
  Ruler,
  Leaf,
  Droplets,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCampaignSubmissions } from '@/lib/api/workflow-hooks';
import { AFRICA_COUNTRIES } from '@/components/dashboard/maps/africa-geo-data';

/* ── Country code helpers ── */
const ISO2_TO_NAME: Record<string, string> = {};
for (const c of AFRICA_COUNTRIES) {
  ISO2_TO_NAME[c.code] = c.name;
}
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

function resolveCountryName(raw: string): string {
  if (!raw) return raw || '—';
  const cleaned = raw.trim().toLowerCase().replace(/[^a-zà-ÿ\s'-]/g, '');
  if (cleaned.length === 2) {
    const upper = cleaned.toUpperCase();
    return ISO2_TO_NAME[upper] || raw;
  }
  const code = COUNTRY_NAME_TO_ISO2[cleaned];
  if (code) return ISO2_TO_NAME[code] || raw;
  return raw;
}

/* ── Shared chart components ── */

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

function HBarChart({ entries, color, unit }: { entries: { label: string; value: number }[]; color: string; unit?: string }) {
  const max = entries[0]?.value || 1;
  return (
    <div className="space-y-1.5">
      {entries.map((e) => (
        <div key={e.label} className="flex items-center gap-2">
          <span className="w-[60px] shrink-0 truncate text-right text-xs text-gray-500">{e.label}</span>
          <div className="h-5 flex-1 rounded bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded" style={{ width: `${(e.value / max) * 100}%`, backgroundColor: color }} />
          </div>
          <span className="w-[50px] text-right text-xs font-medium text-gray-600">{e.value.toLocaleString()}{unit || ''}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Helpers ── */

const PIE_COLORS = ['#0EA5E9', '#059669', '#F59E0B', '#7C3AED', '#DC2626', '#EA580C', '#0891B2', '#4F46E5', '#D97706', '#10B981', '#6366F1', '#EC4899'];

function countBy(items: any[], field: string): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const val = String(item[field] || 'Unknown').trim();
    if (val && val !== 'undefined') map.set(val, (map.get(val) || 0) + 1);
  }
  return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function sumBy(items: any[], groupField: string, sumField: string): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = String(item[groupField] || 'Unknown').trim();
    const val = parseFloat(item[sumField]) || 0;
    if (key && key !== 'undefined') map.set(key, (map.get(key) || 0) + val);
  }
  return Array.from(map.entries()).map(([label, value]) => ({ label, value: Math.round(value) })).sort((a, b) => b.value - a.value);
}

function uniqueCount(items: any[], field: string): number {
  const s = new Set<string>();
  for (const item of items) {
    const v = item[field];
    if (v) s.add(String(v).trim().toLowerCase());
  }
  return s.size;
}

function fmtTonnes(kg: number): string {
  return (kg / 1000).toFixed(1) + ' t';
}

function topEntry(entries: { label: string; value: number }[]): string {
  return entries[0]?.label || '—';
}

/* ── Campaign type detection ── */
type CampaignType = 'captures' | 'vessels' | 'farms' | 'aquaculture' | 'effort' | 'trade' | 'unknown';

function detectType(data: Record<string, any>): CampaignType {
  if (!data) return 'unknown';
  const keys = Object.keys(data);
  const has = (...fields: string[]) => fields.every((f) => keys.includes(f));
  if (has('gear_type', 'quantity_kg', 'capture_date')) return 'captures';
  if (has('vessel_name', 'vessel_type', 'registration_number')) return 'vessels';
  if (has('farm_name', 'farm_type', 'water_source')) return 'farms';
  if (has('harvest_date', 'method_of_culture', 'fcr')) return 'aquaculture';
  if (has('effort_type', 'effort_value')) return 'effort';
  if (has('flow_direction', 'export_country')) return 'trade';
  return 'unknown';
}

/* ── Layout shell ── */
function DashShell({ color, icon: Icon, title, badge, footer, children, loading }: {
  color: string; icon: React.ElementType; title: string; badge: string; footer: string;
  children: React.ReactNode; loading?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-950">
      <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: color }}>
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-white/80" />
          <span className="text-sm font-bold tracking-wide text-white">{title}</span>
        </div>
        <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">{badge}</span>
      </div>
      {loading ? (
        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="min-h-[200px] rounded-xl" />)}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4 space-y-4">{children}</div>
      )}
      <div className="px-4 py-1.5 text-[9px] leading-snug text-white/90" style={{ backgroundColor: color }}>
        <strong>Source :</strong> {footer}
      </div>
    </div>
  );
}

function KpiRow({ items, loading }: { items: { icon: React.ElementType; val: string | number; label: string; color: string; bg: string }[]; loading?: boolean }) {
  return (
    <div className={`grid divide-x divide-gray-200 border-b border-gray-300 bg-white dark:divide-gray-700 dark:bg-gray-900`}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {loading
        ? Array.from({ length: items.length }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)
        : items.map((k, i) => {
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
          })}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">{title}</h3>
      {children}
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-auto max-h-[400px] rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
          <tr className="text-[11px] uppercase tracking-wider text-gray-500">
            {headers.map((h) => <th key={h} className="px-4 py-2 text-left font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-4 py-6 text-center text-gray-400 italic">No data</td></tr>
          ) : rows.map((cells, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              {cells.map((c, j) => (
                <td key={j} className="px-4 py-2 text-gray-700 dark:text-gray-300">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================== */
/*  Sub-dashboards                                                     */
/* ================================================================== */

/* ── 1. Captures ── */
function CapturesDashboard({ subs }: { subs: any[] }) {
  const data = useMemo(() => subs.map((s) => s.data || {}), [subs]);
  const totalKg = useMemo(() => data.reduce((s, d) => s + (parseFloat(d.quantity_kg) || 0), 0), [data]);
  const countries = uniqueCount(data, 'country');
  const species = uniqueCount(data, 'species');
  const gearTypes = countBy(data, 'gear_type');
  const envEntries = countBy(data, 'fishing_environment');
  const prodTypes = countBy(data, 'production_type');
  const speciesByQty = sumBy(data, 'species', 'quantity_kg').slice(0, 10);
  const countriesByQty = sumBy(data, 'country', 'quantity_kg').slice(0, 10).map((e) => ({ ...e, label: resolveCountryName(e.label) }));

  return (
    <DashShell color="#0EA5E9" icon={Fish} title="AFADATA Fisheries - Captures" badge={`${subs.length} records`}
      footer={`AFADATA Fisheries Captures survey - AU-IBAR. ${subs.length} submissions from ${countries} countries.`}>
      <KpiRow items={[
        { icon: BarChart3, val: fmtTonnes(totalKg), label: 'Total catches', color: '#0EA5E9', bg: '#F0F9FF' },
        { icon: Globe2, val: countries, label: 'Countries', color: '#059669', bg: '#ECFDF5' },
        { icon: Fish, val: species, label: 'Species', color: '#7C3AED', bg: '#F5F3FF' },
        { icon: Anchor, val: topEntry(gearTypes), label: 'Top gear type', color: '#EA580C', bg: '#FFF7ED' },
      ]} />
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Fishing Environment"><PieChart entries={envEntries} colors={PIE_COLORS} size={140} /></ChartCard>
        <ChartCard title="Production Type"><PieChart entries={prodTypes} colors={['#0EA5E9', '#F59E0B', '#059669', '#7C3AED', '#DC2626']} size={140} /></ChartCard>
        <ChartCard title="Gear Types"><PieChart entries={gearTypes.slice(0, 8)} colors={PIE_COLORS} size={140} /></ChartCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Top 10 Species by Quantity (kg)"><HBarChart entries={speciesByQty} color="#0EA5E9" /></ChartCard>
        <ChartCard title="Top 10 Countries by Quantity (kg)"><HBarChart entries={countriesByQty} color="#0891B2" /></ChartCard>
      </div>
      <DataTable
        headers={['Country', 'Species', 'Quantity (kg)', 'Gear', 'Date', 'Landing Site']}
        rows={data.slice(0, 200).map((d) => [
          resolveCountryName(d.country),
          d.species || '—',
          (parseFloat(d.quantity_kg) || 0).toLocaleString(),
          d.gear_type || '—',
          d.capture_date || '—',
          d.landing_site || '—',
        ])}
      />
    </DashShell>
  );
}

/* ── 2. Vessels ── */
function VesselsDashboard({ subs }: { subs: any[] }) {
  const data = useMemo(() => subs.map((s) => s.data || {}), [subs]);
  const totalVessels = data.length;
  const activeVessels = data.filter((d) => (d.status || '').toLowerCase() === 'active').length;
  const countries = uniqueCount(data, 'country');
  const crewVals = data.map((d) => parseFloat(d.crew_capacity) || 0).filter((v) => v > 0);
  const avgCrew = crewVals.length > 0 ? Math.round(crewVals.reduce((a, b) => a + b, 0) / crewVals.length) : 0;
  const vesselTypes = countBy(data, 'vessel_type');
  const countriesByCount = countBy(data, 'country').slice(0, 10).map((e) => ({ ...e, label: resolveCountryName(e.label) }));

  return (
    <DashShell color="#0284C7" icon={Ship} title="AFADATA Fisheries - Vessels" badge={`${totalVessels} vessels`}
      footer={`AFADATA Fisheries Vessels registry - AU-IBAR. ${totalVessels} vessels from ${countries} countries.`}>
      <KpiRow items={[
        { icon: Ship, val: totalVessels, label: 'Total vessels', color: '#0284C7', bg: '#F0F9FF' },
        { icon: Anchor, val: activeVessels, label: 'Active vessels', color: '#059669', bg: '#ECFDF5' },
        { icon: Globe2, val: countries, label: 'Countries', color: '#7C3AED', bg: '#F5F3FF' },
        { icon: Users, val: avgCrew, label: 'Avg crew capacity', color: '#EA580C', bg: '#FFF7ED' },
      ]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Vessel Types"><PieChart entries={vesselTypes.slice(0, 8)} colors={PIE_COLORS} size={140} /></ChartCard>
        <ChartCard title="Active vs Inactive">
          <DonutChart entries={[{ label: 'Active', value: activeVessels }, { label: 'Inactive', value: totalVessels - activeVessels }]}
            colors={['#059669', '#9CA3AF']} size={140} centerLabel={`${Math.round((activeVessels / (totalVessels || 1)) * 100)}%`} />
        </ChartCard>
      </div>
      <ChartCard title="Vessels by Country (Top 10)"><HBarChart entries={countriesByCount} color="#0284C7" /></ChartCard>
      <DataTable
        headers={['Name', 'Type', 'Country', 'Length (m)', 'Tonnage', 'Crew', 'License']}
        rows={data.slice(0, 200).map((d) => [
          d.vessel_name || '—',
          d.vessel_type || '—',
          resolveCountryName(d.country),
          d.length_m || '—',
          d.tonnage || '—',
          d.crew_capacity || '—',
          d.license_number ? (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">Licensed</span>
          ) : (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">No license</span>
          ),
        ])}
      />
    </DashShell>
  );
}

/* ── 3. Farms ── */
function FarmsDashboard({ subs }: { subs: any[] }) {
  const data = useMemo(() => subs.map((s) => s.data || {}), [subs]);
  const totalFarms = data.length;
  const totalWorkers = data.reduce((s, d) => s + (parseFloat(d.total_workers) || (parseFloat(d.male_workers) || 0) + (parseFloat(d.female_workers) || 0)), 0);
  const activeFarms = data.filter((d) => (d.status || '').toLowerCase() === 'active').length || data.length;
  const totalArea = data.reduce((s, d) => s + (parseFloat(d.area_ha) || parseFloat(d.total_area) || 0), 0);
  const countries = uniqueCount(data, 'country');
  const farmTypes = countBy(data, 'farm_type');
  const waterSources = countBy(data, 'water_source');
  const countriesByCount = countBy(data, 'country').slice(0, 10).map((e) => ({ ...e, label: resolveCountryName(e.label) }));
  const maleWorkers = data.reduce((s, d) => s + (parseFloat(d.male_workers) || 0), 0);
  const femaleWorkers = data.reduce((s, d) => s + (parseFloat(d.female_workers) || 0), 0);

  return (
    <DashShell color="#059669" icon={Factory} title="AFADATA Fisheries - Aquaculture Farms" badge={`${totalFarms} farms`}
      footer={`AFADATA Fisheries Aquaculture Farms survey - AU-IBAR. ${totalFarms} farms from ${countries} countries.`}>
      <KpiRow items={[
        { icon: Factory, val: totalFarms, label: 'Total farms', color: '#059669', bg: '#ECFDF5' },
        { icon: Users, val: Math.round(totalWorkers), label: 'Total workers', color: '#0284C7', bg: '#F0F9FF' },
        { icon: Leaf, val: activeFarms, label: 'Active farms', color: '#7C3AED', bg: '#F5F3FF' },
        { icon: Ruler, val: totalArea.toFixed(1) + ' ha', label: 'Total area', color: '#EA580C', bg: '#FFF7ED' },
      ]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Farm Types"><PieChart entries={farmTypes.slice(0, 8)} colors={PIE_COLORS} size={140} /></ChartCard>
        <ChartCard title="Water Sources"><PieChart entries={waterSources.slice(0, 8)} colors={['#0EA5E9', '#059669', '#F59E0B', '#7C3AED', '#DC2626']} size={140} /></ChartCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Farms by Country (Top 10)"><HBarChart entries={countriesByCount} color="#059669" /></ChartCard>
        <ChartCard title="Workers by Gender">
          <DonutChart entries={[{ label: 'Male', value: Math.round(maleWorkers) }, { label: 'Female', value: Math.round(femaleWorkers) }]}
            colors={['#0284C7', '#EC4899']} size={140} centerLabel={`${Math.round(totalWorkers)}`} />
        </ChartCard>
      </div>
      <DataTable
        headers={['Farm', 'Type', 'Country', 'Area (ha)', 'Workers', 'Ponds']}
        rows={data.slice(0, 200).map((d) => [
          d.farm_name || '—',
          d.farm_type || '—',
          resolveCountryName(d.country),
          d.area_ha || d.total_area || '—',
          d.total_workers || String((parseFloat(d.male_workers) || 0) + (parseFloat(d.female_workers) || 0)) || '—',
          d.number_of_ponds || d.ponds || '—',
        ])}
      />
    </DashShell>
  );
}

/* ── 4. Aquaculture Production ── */
function AquacultureDashboard({ subs }: { subs: any[] }) {
  const data = useMemo(() => subs.map((s) => s.data || {}), [subs]);
  const totalHarvestKg = data.reduce((s, d) => s + (parseFloat(d.harvest_quantity_kg) || parseFloat(d.quantity_kg) || 0), 0);
  const species = uniqueCount(data, 'species');
  const survivalRates = data.map((d) => parseFloat(d.survival_rate) || 0).filter((v) => v > 0);
  const avgSurvival = survivalRates.length > 0 ? (survivalRates.reduce((a, b) => a + b, 0) / survivalRates.length).toFixed(1) : '—';
  const fcrVals = data.map((d) => parseFloat(d.fcr) || 0).filter((v) => v > 0);
  const avgFcr = fcrVals.length > 0 ? (fcrVals.reduce((a, b) => a + b, 0) / fcrVals.length).toFixed(2) : '—';
  const cultureMethods = countBy(data, 'method_of_culture');
  const speciesByQty = sumBy(data, 'species', 'harvest_quantity_kg').length > 0
    ? sumBy(data, 'species', 'harvest_quantity_kg').slice(0, 10)
    : sumBy(data, 'species', 'quantity_kg').slice(0, 10);
  const countriesByQty = (sumBy(data, 'country', 'harvest_quantity_kg').length > 0
    ? sumBy(data, 'country', 'harvest_quantity_kg')
    : sumBy(data, 'country', 'quantity_kg')
  ).slice(0, 10).map((e) => ({ ...e, label: resolveCountryName(e.label) }));

  return (
    <DashShell color="#10B981" icon={Waves} title="AFADATA Fisheries - Aquaculture Production" badge={`${subs.length} records`}
      footer={`AFADATA Fisheries Aquaculture Production survey - AU-IBAR. ${subs.length} production records.`}>
      <KpiRow items={[
        { icon: BarChart3, val: fmtTonnes(totalHarvestKg), label: 'Total harvest', color: '#10B981', bg: '#ECFDF5' },
        { icon: Fish, val: species, label: 'Species', color: '#0284C7', bg: '#F0F9FF' },
        { icon: TrendingUp, val: avgSurvival + '%', label: 'Avg survival rate', color: '#7C3AED', bg: '#F5F3FF' },
        { icon: Ruler, val: avgFcr, label: 'Avg FCR', color: '#EA580C', bg: '#FFF7ED' },
      ]} />
      <div className="grid gap-4 lg:grid-cols-1">
        <ChartCard title="Culture Methods"><PieChart entries={cultureMethods.slice(0, 8)} colors={PIE_COLORS} size={140} /></ChartCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Production by Species (Top 10, kg)"><HBarChart entries={speciesByQty} color="#10B981" /></ChartCard>
        <ChartCard title="Production by Country (Top 10, kg)"><HBarChart entries={countriesByQty} color="#059669" /></ChartCard>
      </div>
      <DataTable
        headers={['Farm', 'Species', 'Quantity (kg)', 'Method', 'Survival %', 'Harvest Weight']}
        rows={data.slice(0, 200).map((d) => [
          d.farm_name || d.farm || '—',
          d.species || '—',
          (parseFloat(d.harvest_quantity_kg) || parseFloat(d.quantity_kg) || 0).toLocaleString(),
          d.method_of_culture || '—',
          d.survival_rate ? d.survival_rate + '%' : '—',
          d.harvest_weight || d.average_harvest_weight || '—',
        ])}
      />
    </DashShell>
  );
}

/* ── 5. Fishing Effort ── */
function EffortDashboard({ subs }: { subs: any[] }) {
  const data = useMemo(() => subs.map((s) => s.data || {}), [subs]);
  const countries = uniqueCount(data, 'country');
  const crewVals = data.map((d) => parseFloat(d.crew_size) || 0).filter((v) => v > 0);
  const avgCrew = crewVals.length > 0 ? Math.round(crewVals.reduce((a, b) => a + b, 0) / crewVals.length) : 0;
  const effortTypes = countBy(data, 'effort_type');
  const gearTypes = countBy(data, 'gear_type');
  const countriesByCount = countBy(data, 'country').slice(0, 10).map((e) => ({ ...e, label: resolveCountryName(e.label) }));

  return (
    <DashShell color="#7C3AED" icon={Anchor} title="AFADATA Fisheries - Fishing Effort" badge={`${subs.length} records`}
      footer={`AFADATA Fisheries Fishing Effort survey - AU-IBAR. ${subs.length} effort records from ${countries} countries.`}>
      <KpiRow items={[
        { icon: BarChart3, val: subs.length, label: 'Total records', color: '#7C3AED', bg: '#F5F3FF' },
        { icon: Globe2, val: countries, label: 'Countries', color: '#059669', bg: '#ECFDF5' },
        { icon: Users, val: avgCrew, label: 'Avg crew size', color: '#0284C7', bg: '#F0F9FF' },
        { icon: Anchor, val: topEntry(effortTypes), label: 'Top effort type', color: '#EA580C', bg: '#FFF7ED' },
      ]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Effort Types"><PieChart entries={effortTypes.slice(0, 8)} colors={PIE_COLORS} size={140} /></ChartCard>
        <ChartCard title="Gear Types"><PieChart entries={gearTypes.slice(0, 8)} colors={['#7C3AED', '#0EA5E9', '#F59E0B', '#059669', '#DC2626', '#EA580C']} size={140} /></ChartCard>
      </div>
      <ChartCard title="Effort by Country (Top 10)"><HBarChart entries={countriesByCount} color="#7C3AED" /></ChartCard>
      <DataTable
        headers={['Vessel', 'Type', 'Value', 'Unit', 'Gear', 'Crew', 'Period']}
        rows={data.slice(0, 200).map((d) => [
          d.vessel_name || d.vessel || '—',
          d.effort_type || '—',
          d.effort_value || '—',
          d.effort_unit || d.unit || '—',
          d.gear_type || '—',
          d.crew_size || '—',
          d.period || d.fishing_period || '—',
        ])}
      />
    </DashShell>
  );
}

/* ── 6. Fish Trade ── */
function TradeDashboard({ subs }: { subs: any[] }) {
  const data = useMemo(() => subs.map((s) => s.data || {}), [subs]);
  const totalKg = data.reduce((s, d) => s + (parseFloat(d.quantity_kg) || parseFloat(d.quantity) || 0), 0);
  const exportKg = data.filter((d) => (d.flow_direction || '').toLowerCase().includes('export'))
    .reduce((s, d) => s + (parseFloat(d.quantity_kg) || parseFloat(d.quantity) || 0), 0);
  const importKg = data.filter((d) => (d.flow_direction || '').toLowerCase().includes('import'))
    .reduce((s, d) => s + (parseFloat(d.quantity_kg) || parseFloat(d.quantity) || 0), 0);
  const countries = uniqueCount(data, 'export_country');
  const flowDirs = countBy(data, 'flow_direction');
  const productStates = countBy(data, 'product_state');
  const commodityGroups = countBy(data, 'commodity_group');
  const countriesByQty = sumBy(data, 'export_country', 'quantity_kg').length > 0
    ? sumBy(data, 'export_country', 'quantity_kg').slice(0, 10).map((e) => ({ ...e, label: resolveCountryName(e.label) }))
    : sumBy(data, 'export_country', 'quantity').slice(0, 10).map((e) => ({ ...e, label: resolveCountryName(e.label) }));

  return (
    <DashShell color="#F59E0B" icon={ArrowLeftRight} title="AFADATA Fisheries - Fish Trade" badge={`${subs.length} records`}
      footer={`AFADATA Fisheries Fish Trade survey - AU-IBAR. ${subs.length} trade records involving ${countries} countries.`}>
      <KpiRow items={[
        { icon: BarChart3, val: fmtTonnes(totalKg), label: 'Total trade volume', color: '#F59E0B', bg: '#FFFBEB' },
        { icon: TrendingUp, val: fmtTonnes(exportKg), label: 'Export volume', color: '#059669', bg: '#ECFDF5' },
        { icon: Droplets, val: fmtTonnes(importKg), label: 'Import volume', color: '#0284C7', bg: '#F0F9FF' },
        { icon: Globe2, val: countries, label: 'Countries', color: '#7C3AED', bg: '#F5F3FF' },
      ]} />
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Flow Direction"><PieChart entries={flowDirs} colors={['#059669', '#0284C7', '#F59E0B', '#7C3AED']} size={140} /></ChartCard>
        <ChartCard title="Product States"><PieChart entries={productStates.slice(0, 8)} colors={PIE_COLORS} size={140} /></ChartCard>
        <ChartCard title="Commodity Groups"><PieChart entries={commodityGroups.slice(0, 8)} colors={['#F59E0B', '#0EA5E9', '#059669', '#7C3AED', '#DC2626', '#EA580C']} size={140} /></ChartCard>
      </div>
      <ChartCard title="Trade by Country (Top 10, kg)"><HBarChart entries={countriesByQty} color="#F59E0B" /></ChartCard>
      <DataTable
        headers={['Direction', 'Exporter', 'Importer', 'Species', 'Commodity', 'Qty (kg)', 'Value (USD)']}
        rows={data.slice(0, 200).map((d) => [
          d.flow_direction || '—',
          resolveCountryName(d.export_country),
          resolveCountryName(d.import_country),
          d.species || d.species_name || '—',
          d.commodity_group || d.commodity || '—',
          (parseFloat(d.quantity_kg) || parseFloat(d.quantity) || 0).toLocaleString(),
          d.value_usd ? '$' + parseFloat(d.value_usd).toLocaleString() : '—',
        ])}
      />
    </DashShell>
  );
}

/* ================================================================== */
/*  Main FisheriesDashboard component                                  */
/* ================================================================== */

export default function FisheriesDashboard({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const sQ = useCampaignSubmissions(campaignId, { limit: 100 });
  const rawSubs: any[] = Array.isArray(sQ.data?.data) ? sQ.data.data : [];
  const loading = sQ.isLoading;

  const campaignType = useMemo<CampaignType>(() => {
    if (rawSubs.length === 0) return 'unknown';
    return detectType(rawSubs[0]?.data || {});
  }, [rawSubs]);

  if (loading) {
    return (
      <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-950">
        <div className="flex items-center justify-between bg-[#0EA5E9] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Fish className="h-5 w-5 text-white/80" />
            <span className="text-sm font-bold tracking-wide text-white">AFADATA Fisheries Dashboard</span>
          </div>
          <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">Loading...</span>
        </div>
        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="min-h-[200px] rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (rawSubs.length === 0 || campaignType === 'unknown') {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 shadow-sm dark:border-gray-700 dark:bg-gray-950">
        <Fish className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-sm text-gray-500">No submission data available for this AFADATA campaign.</p>
        <p className="text-xs text-gray-400 mt-1">{campaignName}</p>
      </div>
    );
  }

  switch (campaignType) {
    case 'captures': return <CapturesDashboard subs={rawSubs} />;
    case 'vessels': return <VesselsDashboard subs={rawSubs} />;
    case 'farms': return <FarmsDashboard subs={rawSubs} />;
    case 'aquaculture': return <AquacultureDashboard subs={rawSubs} />;
    case 'effort': return <EffortDashboard subs={rawSubs} />;
    case 'trade': return <TradeDashboard subs={rawSubs} />;
    default: return null;
  }
}
