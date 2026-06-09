'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  Fish,
  Anchor,
  Ship,
  Warehouse,
  Activity,
  Globe,
  TrendingUp,
  ArrowUpDown,
  LayoutDashboard,
  Clock,
  MapPin,
  FileText,
} from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  useCollectionCampaigns,
} from '@/lib/api/workflow-hooks';
import { AFRICA_COUNTRIES, AFRICA_COUNTRY_MAP } from '@/components/dashboard/maps/africa-geo-data';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';

/* ── Colors ─────────────────────────────────────────── */

const FISH_COLOR = '#0277BD';
const PIE_COLORS = ['#0277BD', '#00838F', '#2E7D32', '#E65100', '#6A1B9A', '#C62828', '#1565C0', '#F9A825', '#795548', '#37474F'];

/* ── Helpers ────────────────────────────────────────── */

function classifyCampaign(name: string): string {
  const n = (typeof name === 'string' ? name : '').toLowerCase();
  if (n.includes('capture')) return 'captures';
  if (n.includes('vessel') || n.includes('fleet')) return 'vessels';
  if (n.includes('farm') || n.includes('registration')) return 'farms';
  if (n.includes('aquaculture') && n.includes('production')) return 'aquaculture';
  if (n.includes('effort')) return 'efforts';
  if (n.includes('trade')) return 'trades';
  // fallback: check for aquaculture last
  if (n.includes('aquaculture')) return 'aquaculture';
  return 'other';
}

function resolveCampaignName(name: any): string {
  if (!name) return '';
  if (typeof name === 'string') return name;
  return name.en ?? name.fr ?? Object.values(name)[0] ?? '';
}

function resolveCountryName(adm0: string | undefined): string {
  if (!adm0) return 'Unknown';
  const upper = adm0.toUpperCase();
  const entry = AFRICA_COUNTRY_MAP.get(upper);
  return entry?.name ?? upper;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/* ── Submission fetcher (outside hook rules — uses useQueries) ── */

function wfFetchRaw(url: string) {
  return fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });
}

/* ── Main Page ──────────────────────────────────────── */

export default function FisheriesPage() {
  /* 1. Fetch all fisheries campaigns */
  const campaignsQuery = useCollectionCampaigns({ domain: 'fisheries', limit: 50 });
  const campaigns: any[] = useMemo(
    () => (Array.isArray(campaignsQuery.data?.data) ? campaignsQuery.data.data : []),
    [campaignsQuery.data],
  );

  /* 2. For each campaign, fetch submissions */
  const submissionQueries = useQueries({
    queries: campaigns.map((c: any) => ({
      queryKey: ['campaign-submissions', c.id, { limit: 5000 }],
      queryFn: () => {
        const qs = new URLSearchParams();
        qs.set('campaign', c.id);
        qs.set('limit', '5000');
        return wfFetchRaw(`/api/v1/collecte/submissions?${qs}`);
      },
      enabled: !!c.id,
      staleTime: 60_000,
    })),
  });

  const allLoading = campaignsQuery.isLoading || submissionQueries.some((q) => q.isLoading);

  /* 3. Classify and aggregate */
  const { kpis, envPie, vesselPie, farmPie, topSpecies, topCountries, recentSubs } = useMemo(() => {
    const buckets: Record<string, any[]> = {
      captures: [], vessels: [], farms: [], aquaculture: [], efforts: [], trades: [], other: [],
    };

    const allSubs: any[] = [];

    campaigns.forEach((c, idx) => {
      const subs: any[] = submissionQueries[idx]?.data?.data ?? [];
      const cat = classifyCampaign(resolveCampaignName(c.name));
      subs.forEach((s: any) => {
        const entry = { ...s, _category: cat, _campaignName: resolveCampaignName(c.name) };
        buckets[cat]?.push(entry) ?? buckets.other.push(entry);
        allSubs.push(entry);
      });
    });

    /* KPIs */
    const totalCapturesKg = buckets.captures.reduce((s, sub) => s + (parseFloat(sub.data?.quantity_kg) || 0), 0);
    const vesselCount = buckets.vessels.length;
    const farmCount = buckets.farms.length;
    const aquaProdKg = buckets.aquaculture.reduce((s, sub) => s + (parseFloat(sub.data?.quantity_kg) || 0), 0);
    const tradeQty = buckets.trades.reduce((s, sub) => s + (parseFloat(sub.data?.quantity) || 0), 0);

    const countrySet = new Set<string>();
    allSubs.forEach((s) => {
      const adm = s.data?.adm0;
      if (adm) countrySet.add(adm.toUpperCase());
    });

    /* Pie: Fishing Environment */
    const envMap = new Map<string, number>();
    buckets.captures.forEach((s) => {
      const env = s.data?.fishing_environment || 'Unknown';
      envMap.set(env, (envMap.get(env) ?? 0) + 1);
    });
    const envPieData = Array.from(envMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    /* Pie: Vessel Types */
    const vtMap = new Map<string, number>();
    buckets.vessels.forEach((s) => {
      const vt = s.data?.vessel_type || 'Unknown';
      vtMap.set(vt, (vtMap.get(vt) ?? 0) + 1);
    });
    const vesselPieData = Array.from(vtMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    /* Pie: Farm Types */
    const ftMap = new Map<string, number>();
    buckets.farms.forEach((s) => {
      const ft = s.data?.farm_type || 'Unknown';
      ftMap.set(ft, (ftMap.get(ft) ?? 0) + 1);
    });
    const farmPieData = Array.from(ftMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    /* Bar: Top 10 species by capture volume */
    const specMap = new Map<string, number>();
    buckets.captures.forEach((s) => {
      const sp = s.data?.species || 'Unknown';
      const kg = parseFloat(s.data?.quantity_kg) || 0;
      specMap.set(sp, (specMap.get(sp) ?? 0) + kg);
    });
    const topSpeciesData = Array.from(specMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value / 1000) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    /* Bar: Top 10 countries by total catches */
    const countryCapMap = new Map<string, number>();
    buckets.captures.forEach((s) => {
      const adm = s.data?.adm0?.toUpperCase() || 'XX';
      const kg = parseFloat(s.data?.quantity_kg) || 0;
      countryCapMap.set(adm, (countryCapMap.get(adm) ?? 0) + kg);
    });
    const topCountriesData = Array.from(countryCapMap.entries())
      .map(([code, value]) => ({ name: resolveCountryName(code), value: Math.round(value / 1000) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    /* Recent submissions (last 20) */
    const recentSubsData = [...allSubs]
      .sort((a, b) => new Date(b.createdAt ?? b.submittedAt ?? 0).getTime() - new Date(a.createdAt ?? a.submittedAt ?? 0).getTime())
      .slice(0, 20);

    return {
      kpis: {
        totalCaptures: Math.round(totalCapturesKg / 1000),
        vesselCount,
        farmCount,
        aquaProd: Math.round(aquaProdKg / 1000),
        tradeVol: Math.round(tradeQty),
        countriesReporting: countrySet.size,
      },
      envPie: envPieData,
      vesselPie: vesselPieData,
      farmPie: farmPieData,
      topSpecies: topSpeciesData,
      topCountries: topCountriesData,
      recentSubs: recentSubsData,
    };
  }, [campaigns, submissionQueries]);

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div
        className="rounded-xl border p-6"
        style={{
          borderColor: `${FISH_COLOR}30`,
          background: `linear-gradient(135deg, ${FISH_COLOR}08 0%, transparent 60%)`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-white text-lg font-bold"
              style={{ backgroundColor: FISH_COLOR }}
            >
              <Fish className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Fisheries & Aquaculture
              </h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Captures, fleet, licenses, aquaculture, aquatic health — AFADATA Campaign Data
              </p>
            </div>
          </div>
          <Link
            href="/my-dashboards?domain=fisheries"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Advanced Dashboards
          </Link>
        </div>
      </div>

      {/* ── KPI Bar ────────────────────────────────────── */}
      {allLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="absolute inset-x-0 top-0 h-[3px] animate-pulse bg-gray-200 dark:bg-gray-700" />
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-5 w-14 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-2.5 w-20 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="Total Captures"
            value={fmt(kpis.totalCaptures)}
            suffix=" t"
            icon={<Anchor className="h-4 w-4" />}
            color="#00838F"
            gradient="linear-gradient(90deg, #00838F, #4DD0E1)"
          />
          <KpiCard
            label="Fishing Vessels"
            value={fmt(kpis.vesselCount)}
            icon={<Ship className="h-4 w-4" />}
            color="#1565C0"
            gradient="linear-gradient(90deg, #1565C0, #42A5F5)"
          />
          <KpiCard
            label="Aquaculture Farms"
            value={fmt(kpis.farmCount)}
            icon={<Warehouse className="h-4 w-4" />}
            color="#2E7D32"
            gradient="linear-gradient(90deg, #2E7D32, #66BB6A)"
          />
          <KpiCard
            label="Aquaculture Prod."
            value={fmt(kpis.aquaProd)}
            suffix=" t"
            icon={<Activity className="h-4 w-4" />}
            color="#E65100"
            gradient="linear-gradient(90deg, #E65100, #FF9800)"
          />
          <KpiCard
            label="Trade Volume"
            value={fmt(kpis.tradeVol)}
            suffix=" t"
            icon={<ArrowUpDown className="h-4 w-4" />}
            color="#6A1B9A"
            gradient="linear-gradient(90deg, #6A1B9A, #AB47BC)"
          />
          <KpiCard
            label="Countries Reporting"
            value={String(kpis.countriesReporting)}
            suffix="/55"
            icon={<Globe className="h-4 w-4" />}
            color="#0891b2"
            gradient="linear-gradient(90deg, #0891b2, #67e8f9)"
          />
        </div>
      )}

      {/* ── Charts Row 1: 3 Pie Charts ─────────────────── */}
      {!allLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <PieCard title="Fishing Environment" data={envPie} />
          <PieCard title="Vessel Types" data={vesselPie} />
          <PieCard title="Farm Types" data={farmPie} />
        </div>
      )}

      {/* ── Charts Row 2: Bar Charts ───────────────────── */}
      {!allLoading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BarCard title="Top 10 Species by Capture Volume (tonnes)" data={topSpecies} color="#00838F" />
          <BarCard title="Top 10 Countries by Total Catches (tonnes)" data={topCountries} color="#1565C0" />
        </div>
      )}

      {/* ── Recent Submissions Table ───────────────────── */}
      {!allLoading && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Submissions
            </h3>
            <span className="ml-auto text-xs text-gray-400">Last 20 across all campaigns</span>
          </div>

          {recentSubs.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Fish className="h-12 w-12 text-gray-200 dark:text-gray-600" />
              <p className="mt-3 text-sm text-gray-400">No submissions found yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Campaign</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Category</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Country</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Species</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Qty (kg)</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubs.map((sub: any) => {
                    const d = sub.data ?? {};
                    const date = sub.submittedAt ?? sub.createdAt;
                    return (
                      <tr key={sub.id} className="border-b border-gray-50 hover:bg-gray-50/50 dark:border-gray-800 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {date ? new Date(date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[180px] truncate" title={sub._campaignName}>
                          {sub._campaignName}
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize',
                            sub._category === 'captures' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' :
                            sub._category === 'vessels' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            sub._category === 'farms' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            sub._category === 'trades' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          )}>
                            {sub._category}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {resolveCountryName(d.adm0)}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{d.species ?? '-'}</td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 font-medium">
                          {d.quantity_kg ? parseFloat(d.quantity_kg).toLocaleString() : d.quantity ? parseFloat(d.quantity).toLocaleString() : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            sub.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            sub.status === 'VALIDATED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            sub.status === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          )}>
                            {sub.status ?? 'DRAFT'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── KPI Card (matching DomainKpiBar style) ─────────── */

function KpiCard({
  label, value, suffix, icon, color, gradient,
}: {
  label: string; value: string; suffix?: string;
  icon: React.ReactNode; color: string; gradient: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border p-3 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-transparent border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div
        className="absolute inset-x-0 top-0 h-[3px] opacity-80 group-hover:opacity-100 transition-opacity"
        style={{ background: gradient }}
      />
      <div
        className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20"
        style={{ backgroundColor: color }}
      />
      <div className="relative flex items-center gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {value}
              {suffix && (
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{suffix}</span>
              )}
            </p>
          </div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 truncate">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Pie Chart Card ─────────────────────────────────── */

function PieCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
        <div className="flex items-center justify-center py-10 text-xs text-gray-400">No data available</div>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
              style={{ fontSize: 10 }}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString()} (${((value / total) * 100).toFixed(1)}%)`, 'Count']}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E7EB' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
            {d.name} ({d.value})
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Bar Chart Card ─────────────────────────────────── */

function BarCard({ title, data, color }: { title: string; data: { name: string; value: number }[]; color: string }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
        <div className="flex items-center justify-center py-10 text-xs text-gray-400">No data available</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickFormatter={(v) => fmt(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 10, fill: '#6B7280' }}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString()} tonnes`, 'Volume']}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E7EB' }}
            />
            <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
