'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  useHistoricalDatasets,
  useDashboardKpis,
  useCrossTimeSeries,
  useCrossAggregate,
  useDiseaseNameMap,
  resolveDiseaseLabel,
  type HistoricalDataset,
  type DashboardKpis,
} from '@/lib/api/historical-hooks';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const ACCENT_COLORS = [
  '#2e75b6', '#e67e22', '#27ae60', '#c0392b', '#8e44ad',
  '#16a085', '#d35400', '#2c3e50', '#f39c12', '#1abc9c',
];

const YEAR_OPTIONS = Array.from({ length: 18 }, (_, i) => 2025 - i);

/* ------------------------------------------------------------------ */
/*  Main Dashboard                                                      */
/* ------------------------------------------------------------------ */

export default function HistoricalDashboardPage() {
  // Fetch all READY datasets in animal_health domain
  const { data: allDatasetsRes } = useHistoricalDatasets({ limit: 100, status: 'READY' });
  const allDatasets = allDatasetsRes?.data ?? [];

  // Get animal health dataset IDs (the 9 Monthly Health chunks + others)
  const animalHealthIds = useMemo(
    () => allDatasets.filter((d) => d.domain === 'animal_health').map((d) => d.id),
    [allDatasets],
  );
  const allIds = useMemo(() => allDatasets.map((d) => d.id), [allDatasets]);

  // Disease name resolver
  const { data: diseaseMap } = useDiseaseNameMap();

  // Filters — null means "all years"
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedDisease, setSelectedDisease] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [compareCountries, setCompareCountries] = useState<string[]>([]);

  // KPIs — when "All Years", show latest available year (2025)
  const { data: kpisRes, isLoading: kpisLoading } = useDashboardKpis({
    year: selectedYear ?? 2025,
    datasetIds: animalHealthIds,
  });
  const kpis = kpisRes?.data;

  // Epidemic Curve — time series by month
  const epiCurve = useCrossTimeSeries();
  const topDiseases = useCrossAggregate();
  const countryDistribution = useCrossAggregate();
  const comparatorQuery = useCrossTimeSeries();

  // Auto-fetch when dataset IDs are available
  useEffect(() => {
    if (animalHealthIds.length === 0) return;

    // Build date filter (only when a specific year is selected)
    const yearFilter: Record<string, string> | undefined = selectedYear
      ? { dateFrom: `${selectedYear}-01-01`, dateTo: `${selectedYear}-12-31` }
      : undefined;

    // Epidemic curve
    epiCurve.mutate({
      datasetIds: animalHealthIds,
      dateColumn: 'date_of_report',
      valueColumn: 'num_new_outbreaks',
      interval: 'year',
      operation: 'count',
      filters: selectedDisease ? { ...yearFilter, disease: selectedDisease } : yearFilter,
    });

    // Top diseases
    topDiseases.mutate({
      datasetIds: animalHealthIds,
      column: 'disease',
      operation: 'distribution',
      filters: yearFilter,
    });

    // Country distribution
    countryDistribution.mutate({
      datasetIds: animalHealthIds,
      column: 'country',
      operation: 'distribution',
      filters: yearFilter,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animalHealthIds.length, selectedYear, selectedDisease]);

  // Country comparator — triggered when countries are selected
  useEffect(() => {
    if (animalHealthIds.length === 0 || compareCountries.length === 0) return;
    // We'll query each country separately and merge on the frontend
    for (const country of compareCountries) {
      comparatorQuery.mutate({
        datasetIds: animalHealthIds,
        dateColumn: 'date_of_report',
        valueColumn: 'num_new_outbreaks',
        interval: 'year',
        operation: 'count',
        groupBy: 'country',
        filters: { country: country },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animalHealthIds.length, compareCountries]);

  // Extract unique diseases and countries from aggregate results
  const diseaseOptions = useMemo(() => {
    if (!topDiseases.data?.data) return [] as { value: string; label: string }[];
    return (topDiseases.data.data as any[])
      .filter((d: any) => d.label && d.value > 50)
      .slice(0, 50)
      .map((d: any) => ({
        value: String(d.label),
        label: resolveDiseaseLabel(String(d.label), diseaseMap),
      }));
  }, [topDiseases.data, diseaseMap]);

  const countryOptions = useMemo(() => {
    if (!countryDistribution.data?.data) return [];
    return (countryDistribution.data.data as any[])
      .filter((d: any) => d.label && d.value > 10)
      .slice(0, 50)
      .map((d: any) => d.label);
  }, [countryDistribution.data]);

  const isReady = animalHealthIds.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/historical" className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Historical Analytics Dashboard
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Continental disease surveillance trends (2008-2025) — {allDatasets.length} datasets, {allDatasets.reduce((s, d) => s + d.rowCount, 0).toLocaleString()} records
          </p>
        </div>

        {/* Year filter */}
        <select
          value={selectedYear ?? ''}
          onChange={(e) => setSelectedYear(e.target.value === '' ? null : Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
        >
          <option value="">All Years (2008-2025)</option>
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      {isReady && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Disease Reports"
            value={kpis?.totalReports ?? 0}
            change={kpis?.pctChangeReports ?? 0}
            loading={kpisLoading}
            color="#2e75b6"
          />
          <KpiCard
            label="Total Outbreaks"
            value={kpis?.totalOutbreaks ?? 0}
            change={kpis?.pctChangeOutbreaks ?? 0}
            loading={kpisLoading}
            color="#e67e22"
          />
          <KpiCard
            label="Diseases Reported"
            value={kpis?.uniqueDiseases ?? 0}
            change={kpis?.pctChangeDiseases ?? 0}
            loading={kpisLoading}
            color="#27ae60"
          />
          <KpiCard
            label="Locations"
            value={kpis?.uniqueLocations ?? 0}
            change={kpis?.pctChangeLocations ?? 0}
            loading={kpisLoading}
            color="#8e44ad"
          />
        </div>
      )}

      {/* Row 1: Epidemic Curve + Top Diseases */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Epidemic Curve */}
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Epidemic Curve {selectedDisease && `— ${resolveDiseaseLabel(selectedDisease, diseaseMap)}`}
            </h2>
            <select
              value={selectedDisease}
              onChange={(e) => setSelectedDisease(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none"
            >
              <option value="">All Diseases</option>
              {diseaseOptions.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div className="h-[320px]">
            {epiCurve.isPending ? (
              <LoadingChart />
            ) : epiCurve.data ? (
              <EpidemicCurveChart data={epiCurve.data.data as any[]} />
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>

        {/* Top 10 Diseases */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
            Top 15 Diseases ({selectedYear ?? '2008-2025'})
          </h2>
          <div className="h-[320px]">
            {topDiseases.isPending ? (
              <LoadingChart />
            ) : topDiseases.data ? (
              <TopDiseasesChart data={(topDiseases.data.data as any[]).slice(0, 15)} diseaseMap={diseaseMap} />
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Country Distribution + Disease Pie */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Country Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
            Reports by Country/Location ({selectedYear ?? '2008-2025'})
          </h2>
          <div className="h-[350px]">
            {countryDistribution.isPending ? (
              <LoadingChart />
            ) : countryDistribution.data ? (
              <CountryBarChart data={(countryDistribution.data.data as any[]).slice(0, 20)} />
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>

        {/* Disease Pie Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
            Disease Distribution ({selectedYear ?? '2008-2025'})
          </h2>
          <div className="h-[350px]">
            {topDiseases.isPending ? (
              <LoadingChart />
            ) : topDiseases.data ? (
              <DiseasePieChart data={(topDiseases.data.data as any[]).slice(0, 10)} diseaseMap={diseaseMap} />
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Country Comparator */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Country / Location Comparator
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val && !compareCountries.includes(val) && compareCountries.length < 5) {
                  setCompareCountries([...compareCountries, val]);
                }
                e.target.value = '';
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none"
            >
              <option value="">+ Add country...</option>
              {countryOptions
                .filter((c) => !compareCountries.includes(c))
                .map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
            </select>
            {compareCountries.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                {c}
                <button onClick={() => setCompareCountries(compareCountries.filter((x) => x !== c))} className="ml-0.5 hover:text-red-500">&times;</button>
              </span>
            ))}
          </div>
        </div>
        <div className="h-[300px]">
          {compareCountries.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Select up to 5 countries/locations to compare their disease report trends
            </div>
          ) : comparatorQuery.isPending ? (
            <LoadingChart />
          ) : comparatorQuery.data ? (
            <ComparatorChart data={comparatorQuery.data.data as any[]} countries={compareCountries} />
          ) : (
            <EmptyChart />
          )}
        </div>
      </div>

      {/* Datasets Summary Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
          Datasets in this Dashboard
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-2 text-xs font-medium text-slate-500">Name</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-500">Domain</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-500 text-right">Rows</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {allDatasets.map((ds) => (
                <tr key={ds.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-3 py-2">
                    <Link href={`/historical/${ds.id}`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
                      {ds.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{ds.domain}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-300">{ds.rowCount.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {ds.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Sub-components                                                      */
/* ================================================================== */

function KpiCard({ label, value, change, loading, color }: {
  label: string;
  value: number;
  change: number;
  loading: boolean;
  color: string;
}) {
  const isUp = change > 0;
  const isDown = change < 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50">
      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      ) : (
        <>
          <p className="mt-1 text-2xl font-bold" style={{ color }}>{value.toLocaleString()}</p>
          <div className="mt-1 flex items-center gap-1 text-xs">
            {isUp && <span className="text-red-500">+{change}%</span>}
            {isDown && <span className="text-emerald-500">{change}%</span>}
            {!isUp && !isDown && <span className="text-slate-400">0%</span>}
            <span className="text-slate-400">vs. previous year</span>
          </div>
        </>
      )}
    </div>
  );
}

function EpidemicCurveChart({ data }: { data: any[] }) {
  const chartData = data
    .filter((d) => d.period)
    .map((d) => ({
      period: new Date(d.period).getFullYear(),
      value: Number(d.value) || 0,
    }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="epiGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2e75b6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2e75b6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
          formatter={(v: number) => [v.toLocaleString(), 'Reports']}
        />
        <Area type="monotone" dataKey="value" stroke="#2e75b6" strokeWidth={2} fill="url(#epiGrad)" dot />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TopDiseasesChart({ data, diseaseMap }: { data: any[]; diseaseMap?: Record<string, string> }) {
  const chartData = data.map((d, i) => ({
    name: resolveDiseaseLabel(String(d.label || ''), diseaseMap).slice(0, 25),
    value: Number(d.value) || 0,
    fill: ACCENT_COLORS[i % ACCENT_COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
          formatter={(v: number) => [v.toLocaleString(), 'Reports']}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function CountryBarChart({ data }: { data: any[] }) {
  const chartData = data.map((d) => ({
    name: String(d.label || '').slice(0, 20),
    value: Number(d.value) || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={0} height={80} angle={-45} textAnchor="end" />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
          formatter={(v: number) => [v.toLocaleString(), 'Reports']}
        />
        <Bar dataKey="value" fill="#27ae60" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DiseasePieChart({ data, diseaseMap }: { data: any[]; diseaseMap?: Record<string, string> }) {
  const chartData = data.map((d, i) => ({
    name: resolveDiseaseLabel(String(d.label || ''), diseaseMap).slice(0, 20),
    value: Number(d.value) || 0,
    fill: ACCENT_COLORS[i % ACCENT_COLORS.length],
  }));
  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          outerRadius={120}
          innerRadius={60}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
          formatter={(v: number) => [v.toLocaleString(), 'Reports']}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ComparatorChart({ data, countries }: { data: any[]; countries: string[] }) {
  // Group data by period, with each country as a series
  const grouped: Record<string, Record<string, number>> = {};
  for (const d of data) {
    if (!d.period) continue;
    const year = new Date(d.period).getFullYear();
    const key = String(d.group_key || '');
    if (!grouped[year]) grouped[year] = {};
    grouped[year][key] = (grouped[year][key] || 0) + Number(d.value || 0);
  }

  const chartData = Object.entries(grouped)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, values]) => ({ year: Number(year), ...values }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
        />
        <Legend />
        {countries.map((c, i) => (
          <Line
            key={c}
            type="monotone"
            dataKey={c}
            stroke={ACCENT_COLORS[i % ACCENT_COLORS.length]}
            strokeWidth={2}
            dot
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function LoadingChart() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[var(--color-accent)]" />
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      No data available
    </div>
  );
}
