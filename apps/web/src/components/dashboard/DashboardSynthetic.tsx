'use client';

import React, { useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Globe, FileBarChart, Syringe, Stethoscope,
  ClipboardCheck, AlertTriangle, Map as MapIcon,
} from 'lucide-react';
import { useDashboardFilters } from './GlobalFilterContext';
import {
  DEMO_KPIS,
  DEMO_COUNTRY_DATA,
  DEMO_DISEASES,
  DEMO_ALERTS,
  DEMO_MONTHLY_TRENDS,
  DEMO_ADMIN1_DATA,
  filterCountryData,
} from './demo-data';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';

/* ── Lazy map ─────────────────────────────────────────────────────────────── */

const ChoroplethMap = dynamic(
  () => import('./maps/ChoroplethMap').then((m) => m.ChoroplethMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800/50 rounded">
        <MapIcon className="h-6 w-6 text-gray-300 animate-pulse" />
      </div>
    ),
  },
);

/* ── Compact number formatter ─────────────────────────────────────────────── */

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}bn`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* ── KPI items ────────────────────────────────────────────────────────────── */

const KPI_ITEMS = [
  { key: 'countries', label: 'Countries / Regions', value: `${DEMO_KPIS.countriesReporting}`, icon: Globe, color: '#3b82f6' },
  { key: 'reports', label: 'Reports', value: fmt(DEMO_KPIS.totalReports), icon: FileBarChart, color: '#10b981' },
  { key: 'vaccinations', label: 'Vaccinations', value: fmt(DEMO_KPIS.totalVaccinations), icon: Syringe, color: '#8b5cf6' },
  { key: 'treated', label: 'Animals Treated', value: fmt(DEMO_KPIS.totalTreated), icon: Stethoscope, color: '#f59e0b' },
  { key: 'trained', label: 'People Trained', value: fmt(DEMO_KPIS.totalTrained), icon: ClipboardCheck, color: '#06b6d4' },
  { key: 'alerts', label: 'Active Alerts', value: String(DEMO_ALERTS.length), icon: AlertTriangle, color: '#ef4444' },
  { key: 'validation', label: 'Validation Rate', value: `${DEMO_KPIS.validationRate}%`, icon: ClipboardCheck, color: '#22c55e' },
  { key: 'records', label: 'Total Records', value: fmt(DEMO_KPIS.totalRecords), icon: FileBarChart, color: '#f97316' },
];

/* ── Compact widget title ─────────────────────────────────────────────────── */

function WidgetTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-1.5 border-b border-gray-200/60 dark:border-gray-700/40">
      <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide truncate">
        {children}
      </h3>
    </div>
  );
}

/* ── REC distribution data ────────────────────────────────────────────────── */

const REC_LABELS: Record<string, string> = {
  ecowas: 'ECOWAS', eccas: 'ECCAS', eac: 'EAC', sadc: 'SADC',
  igad: 'IGAD', uma: 'UMA', comesa: 'COMESA', censad: 'CEN-SAD',
};

const REC_COLORS: Record<string, string> = {
  ecowas: '#003399', eccas: '#8B0000', eac: '#006B3F', sadc: '#00308F',
  igad: '#FF8C00', uma: '#4B0082', comesa: '#228B22', censad: '#DAA520',
};

/* ── Custom tooltip ───────────────────────────────────────────────────────── */

function CompactTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded bg-gray-900/90 px-2 py-1 text-[10px] text-white shadow">
      <p className="font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function DashboardSynthetic() {
  const { filters, setFilter } = useDashboardFilters();

  const handleCountryClick = useCallback((code: string) => {
    setFilter('country', code);
  }, [setFilter]);

  /* ── Filtered data ────────────────────────────────────────────────────── */

  const filteredCountryData = filterCountryData(DEMO_COUNTRY_DATA, {
    rec: filters.rec,
    country: filters.country,
  });

  /* Top 10 countries by cases — or Admin1 regions when a country is selected */
  const topCountries = useMemo(() =>
    [...filteredCountryData].sort((a, b) => b.cases - a.cases).slice(0, 10),
    [filteredCountryData],
  );

  const admin1CasesData = useMemo(() => {
    const regions = DEMO_ADMIN1_DATA[filters.country] ?? [];
    return [...regions]
      .sort((a, b) => b.cases - a.cases)
      .map((r) => ({ name: r.name, cases: r.cases }));
  }, [filters.country]);

  /* REC outbreak distribution (continental view) */
  const recData = useMemo(() => {
    const map = new Map<string, number>();
    filteredCountryData.forEach((c) => {
      map.set(c.rec, (map.get(c.rec) ?? 0) + c.outbreaks);
    });
    return Array.from(map.entries())
      .map(([rec, outbreaks]) => ({
        name: REC_LABELS[rec] ?? rec.toUpperCase(),
        value: outbreaks,
        color: REC_COLORS[rec] ?? '#6b7280',
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredCountryData]);

  /* Drill-down level detection */
  const isCountrySelected = filters.country !== 'all';
  const isRecSelected = filters.rec !== 'all';

  /* Country outbreak distribution (when a REC is selected) */
  const countryOutbreakData = useMemo(() =>
    [...filteredCountryData]
      .sort((a, b) => b.outbreaks - a.outbreaks)
      .map((c) => ({
        name: c.name,
        value: c.outbreaks,
        color: REC_COLORS[c.rec] ?? 'var(--color-accent, #006B3F)',
      })),
    [filteredCountryData],
  );

  /* Admin1 outbreak distribution (when a country is selected) */
  const admin1Data = useMemo(() => {
    const regions = DEMO_ADMIN1_DATA[filters.country] ?? [];
    return [...regions]
      .sort((a, b) => b.outbreaks - a.outbreaks)
      .map((r) => ({
        name: r.name,
        value: r.outbreaks,
        color: 'var(--color-accent, #006B3F)',
      }));
  }, [filters.country]);

  /* Disease data for horizontal bars */
  const diseaseBarData = useMemo(() =>
    DEMO_DISEASES.slice(0, 8).map((d) => ({ name: d.code, cases: d.cases, color: d.color })),
    [],
  );

  /* Disease for pie */
  const diseasePie = useMemo(() =>
    DEMO_DISEASES.map((d) => ({ name: d.code, value: d.cases, color: d.color })),
    [],
  );

  /* Monthly trends for sparkline */
  const trendData = useMemo(() =>
    DEMO_MONTHLY_TRENDS.map((m) => ({ name: m.label, outbreaks: m.outbreaks, submissions: m.submissions })),
    [],
  );

  /* ── Scope label ──────────────────────────────────────────────────────── */

  const scopeLabel = filters.country !== 'all'
    ? DEMO_COUNTRY_DATA.find((c) => c.code === filters.country)?.name ?? filters.country
    : filters.rec !== 'all'
      ? filters.rec.toUpperCase()
      : 'CONTINENTAL';

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                                */
  /* ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-100 dark:bg-gray-950">

      {/* ── KPI Strip ───────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-stretch divide-x divide-white/10"
        style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 100%)',
        }}
      >
        {KPI_ITEMS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.key} className="flex-1 flex flex-col items-center justify-center px-2 py-2 min-w-0">
              <div className="text-lg sm:text-xl font-black text-white leading-none tracking-tight">
                {kpi.value}
              </div>
              <div className="mt-0.5 text-[9px] font-medium text-gray-400 uppercase tracking-wider truncate text-center w-full">
                {kpi.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Widget Grid — fills remaining height ────────────────────────── */}
      <div className="flex-1 min-h-0 grid grid-rows-2 grid-cols-4 gap-[3px] p-[3px]">

        {/* ── ROW 1 ─────────────────────────────────────────────────────── */}

        {/* 1A: Outbreaks — 3-level drill-down: REC → Country → Admin1 */}
        <div className="bg-white dark:bg-gray-800 rounded overflow-hidden flex flex-col">
          <WidgetTitle>
            {isCountrySelected
              ? `Outbreaks by Region — ${DEMO_COUNTRY_DATA.find((c) => c.code === filters.country)?.name ?? filters.country}`
              : isRecSelected
                ? `Outbreaks by Country — ${REC_LABELS[filters.rec] ?? filters.rec.toUpperCase()}`
                : 'Outbreaks by REC'}
          </WidgetTitle>
          <div className="flex-1 min-h-0 px-1 py-1">
            {isCountrySelected && admin1Data.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-gray-400">
                No admin-level data available for this country
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={isCountrySelected ? admin1Data : isRecSelected ? countryOutbreakData : recData}
                  layout="vertical"
                  margin={{ top: 2, right: 40, bottom: 2, left: 4 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={isCountrySelected ? 85 : isRecSelected ? 75 : 60}
                    tick={{ fontSize: isCountrySelected ? 9 : isRecSelected ? 9 : 10, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CompactTooltip />} />
                  <Bar
                    dataKey="value"
                    radius={[0, 3, 3, 0]}
                    barSize={isCountrySelected ? 11 : isRecSelected ? 12 : 14}
                    label={{ position: 'right', fontSize: 9, fill: '#6b7280' }}
                  >
                    {(isCountrySelected ? admin1Data : isRecSelected ? countryOutbreakData : recData).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 1B: Disease Distribution (pie + legend) */}
        <div className="bg-white dark:bg-gray-800 rounded overflow-hidden flex flex-col">
          <WidgetTitle>Disease Distribution</WidgetTitle>
          <div className="flex-1 min-h-0 flex items-center">
            <div className="w-[55%] h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={diseasePie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="35%"
                    outerRadius="75%"
                    stroke="none"
                    paddingAngle={1}
                  >
                    {diseasePie.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CompactTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-[45%] pr-2 overflow-y-auto max-h-full py-1">
              {diseasePie.slice(0, 7).map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 py-[2px]">
                  <span className="flex-shrink-0 h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] text-gray-600 dark:text-gray-300 truncate">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 1C: Species / Top diseases by cases (horizontal bars with values) */}
        <div className="bg-white dark:bg-gray-800 rounded overflow-hidden flex flex-col">
          <WidgetTitle>Cases by Disease</WidgetTitle>
          <div className="flex-1 min-h-0 px-1 py-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={diseaseBarData}
                layout="vertical"
                margin={{ top: 2, right: 45, bottom: 2, left: 4 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={42}
                  tick={{ fontSize: 9, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CompactTooltip />} />
                <Bar dataKey="cases" radius={[0, 3, 3, 0]} barSize={12} label={{ position: 'right', fontSize: 9, fill: '#6b7280', formatter: (v: number) => v.toLocaleString() }}>
                  {diseaseBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 1D: Top Activities / Outbreaks trend line */}
        <div className="bg-white dark:bg-gray-800 rounded overflow-hidden flex flex-col">
          <WidgetTitle>Monthly Trend — Outbreaks & Submissions</WidgetTitle>
          <div className="flex-1 min-h-0 px-1 py-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<CompactTooltip />} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: 0 }} />
                <Line dataKey="outbreaks" name="Outbreaks" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line dataKey="submissions" name="Submissions" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── ROW 2 ─────────────────────────────────────────────────────── */}

        {/* 2A: Africa Choropleth Map (spans 2 cols) */}
        <div className="col-span-2 bg-white dark:bg-gray-800 rounded overflow-hidden flex flex-col">
          <WidgetTitle>
            {scopeLabel} — Outbreak Map
          </WidgetTitle>
          <div className="flex-1 min-h-0 relative">
            <ChoroplethMap
              title=""
              data={filteredCountryData}
              onCountryClick={handleCountryClick}
              height="100%"
              bare
              demo
              selectedRec={filters.rec}
              selectedCountry={filters.country}
            />
          </div>
        </div>

        {/* 2B: Top Countries/Regions by Cases — 3-level drill-down */}
        <div className="bg-white dark:bg-gray-800 rounded overflow-hidden flex flex-col">
          <WidgetTitle>
            {isCountrySelected
              ? `Top Regions — Cases — ${DEMO_COUNTRY_DATA.find((c) => c.code === filters.country)?.name ?? filters.country}`
              : 'Top Countries — Cases'}
          </WidgetTitle>
          <div className="flex-1 min-h-0 px-1 py-1">
            {isCountrySelected && admin1CasesData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-gray-400">
                No admin-level data available for this country
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={isCountrySelected ? admin1CasesData : topCountries}
                  layout="vertical"
                  margin={{ top: 2, right: 45, bottom: 2, left: 4 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={isCountrySelected ? 85 : 55}
                    tick={{ fontSize: 9, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CompactTooltip />} />
                  <Bar
                    dataKey="cases"
                    fill="var(--color-accent, #006B3F)"
                    radius={[0, 3, 3, 0]}
                    barSize={12}
                    label={{ position: 'right', fontSize: 9, fill: '#6b7280', formatter: (v: number) => v.toLocaleString() }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 2C: Active Alerts (compact table) */}
        <div className="bg-white dark:bg-gray-800 rounded overflow-hidden flex flex-col">
          <WidgetTitle>Active Alerts ({DEMO_ALERTS.length})</WidgetTitle>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {DEMO_ALERTS.slice(0, 8).map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-2 px-2.5 py-1.5 border-b border-gray-100 dark:border-gray-700/30 last:border-0"
              >
                <span className={
                  alert.severity === 'critical'
                    ? 'mt-0.5 flex-shrink-0 h-2 w-2 rounded-full bg-red-500'
                    : alert.severity === 'warning'
                      ? 'mt-0.5 flex-shrink-0 h-2 w-2 rounded-full bg-amber-500'
                      : 'mt-0.5 flex-shrink-0 h-2 w-2 rounded-full bg-blue-400'
                } />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {alert.disease} — {alert.country}
                  </p>
                  <p className="text-[9px] text-gray-400 truncate">
                    {alert.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer disclaimer ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 bg-gray-200/80 dark:bg-gray-800/80 text-[9px] text-gray-500 dark:text-gray-500 border-t border-gray-300/50 dark:border-gray-700/50">
        <span>
          <strong>Data source:</strong> AU-IBAR ARIS 3.0 — Member State submissions, WAHIS, EMPRES, FAOSTAT
        </span>
        <span>
          <strong>Disclaimer:</strong> Boundaries and designations do not imply official AU endorsement. Demo data.
        </span>
        <span>AU-IBAR {new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
