'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { Activity, Shield, Users, Database, FlaskConical, Syringe, AlertTriangle, CheckCircle, Target, TrendingUp } from 'lucide-react';
import { analyticsClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import type { CountryOutbreakData } from '@/components/dashboard/demo-data';
import { AFRICA_COUNTRIES } from '@/components/dashboard/maps/africa-geo-data';

const ChoroplethMap = dynamic(
  () => import('@/components/dashboard/maps/ChoroplethMap').then((m) => m.ChoroplethMap),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);

/* ── Country name → ISO2 ── */
const NAME_TO_ISO2: Record<string, string> = {};
for (const c of AFRICA_COUNTRIES) { NAME_TO_ISO2[c.name.toLowerCase()] = c.code; NAME_TO_ISO2[c.nameFr.toLowerCase()] = c.code; }

/* ── Data hook ── */
function usePPRIndicators() {
  return useQuery({
    queryKey: ['ppr-performance-indicators'],
    queryFn: async () => {
      const res = await analyticsClient.get<any>('/analytics/indicators?typeCode=PPR_IMPACT&limit=50');
      const res2 = await analyticsClient.get<any>('/analytics/indicators?typeCode=PPR_OUTCOME&limit=50');
      const res3 = await analyticsClient.get<any>('/analytics/indicators?typeCode=PPR_OUTPUT&limit=50');
      return { impact: res?.data ?? [], outcome: res2?.data ?? [], output: res3?.data ?? [] };
    },
    staleTime: 5 * 60_000,
  });
}

/* ── Status badge ── */
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  on_watch: { bg: '#FEF3C7', text: '#D97706', label: 'On watch' },
  behind: { bg: '#FEE2E2', text: '#DC2626', label: 'Behind' },
  in_progress: { bg: '#DBEAFE', text: '#2563EB', label: 'In progress' },
  on_track: { bg: '#D1FAE5', text: '#059669', label: 'On track' },
  ready: { bg: '#D1FAE5', text: '#059669', label: 'Ready' },
  partial: { bg: '#FEF3C7', text: '#D97706', label: 'Partial' },
  priority: { bg: '#FEE2E2', text: '#DC2626', label: 'Priority' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? STATUS_COLORS.in_progress;
  return (
    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

/* ── KPI Card (75% → 0% format) ── */
function KpiTarget({ icon: Icon, title, baseline, target, current, unit, status, color }: {
  icon: any; title: string; baseline: number | string; target: number | string; current?: number | string;
  unit?: string; status: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold" style={{ color }}>{baseline}{unit}</span>
        <span className="text-gray-400 text-lg">→</span>
        <span className="text-2xl font-bold text-gray-800 dark:text-white">{target}{unit}</span>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

/* ── Progress bar (horizontal) ── */
function HBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 text-xs text-gray-600 dark:text-gray-400 truncate">{label}</span>
      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden dark:bg-gray-700">
        <div className="h-full rounded-full" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-10 text-right">{value}%</span>
    </div>
  );
}

/* ── Readiness ranking row ── */
function RankingRow({ rank, country, rec, readiness, status }: {
  rank: number; country: string; rec: string; readiness: number; status: string;
}) {
  const barColor = readiness >= 75 ? '#22c55e' : readiness >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <tr className="border-b border-gray-100 dark:border-gray-700 last:border-0">
      <td className="py-2 pl-3">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">{rank}</span>
      </td>
      <td className="py-2 text-xs font-medium text-gray-700 dark:text-gray-300">{country}</td>
      <td className="py-2 text-xs text-gray-500">{rec}</td>
      <td className="py-2 w-32">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-8">{readiness}%</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden dark:bg-gray-700">
            <div className="h-full rounded-full" style={{ width: `${readiness}%`, backgroundColor: barColor }} />
          </div>
        </div>
      </td>
      <td className="py-2 pr-3 text-right"><StatusBadge status={status} /></td>
    </tr>
  );
}

/* ── Gauge circle ── */
function GaugeCircle({ value, label, color, delta }: { value: number; label: string; color: string; delta?: string }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value, 100);
  const dashOffset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="relative h-24 w-24">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={dashOffset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold" style={{ color }}>{value}%</span>
        </div>
      </div>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 text-center">{label}</span>
      {delta && (
        <div className="flex items-center gap-1 text-[10px]">
          <TrendingUp className="h-3 w-3 text-green-500" />
          <span className="text-green-600 font-medium">{delta}</span>
        </div>
      )}
      <div className="w-full h-1.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function PPRPerformanceDashboard() {
  // Map data
  const mapData: CountryOutbreakData[] = [
    { code: 'ZA', name: 'South Africa', outbreaks: 90, cases: 0, deaths: 0, vaccinations: 0, submissions: 90, rec: 'sadc' },
    { code: 'BW', name: 'Botswana', outbreaks: 88, cases: 0, deaths: 0, vaccinations: 0, submissions: 88, rec: 'sadc' },
    { code: 'KE', name: 'Kenya', outbreaks: 85, cases: 0, deaths: 0, vaccinations: 0, submissions: 85, rec: 'igad' },
    { code: 'NG', name: 'Nigeria', outbreaks: 75, cases: 0, deaths: 0, vaccinations: 0, submissions: 75, rec: 'ecowas' },
    { code: 'TZ', name: 'Tanzania', outbreaks: 70, cases: 0, deaths: 0, vaccinations: 0, submissions: 70, rec: 'sadc' },
    { code: 'SN', name: 'Senegal', outbreaks: 65, cases: 0, deaths: 0, vaccinations: 0, submissions: 65, rec: 'ecowas' },
    { code: 'ZW', name: 'Zimbabwe', outbreaks: 65, cases: 0, deaths: 0, vaccinations: 0, submissions: 65, rec: 'sadc' },
    { code: 'UG', name: 'Uganda', outbreaks: 60, cases: 0, deaths: 0, vaccinations: 0, submissions: 60, rec: 'igad' },
    { code: 'ET', name: 'Ethiopia', outbreaks: 55, cases: 0, deaths: 0, vaccinations: 0, submissions: 55, rec: 'igad' },
    { code: 'NE', name: 'Niger', outbreaks: 50, cases: 0, deaths: 0, vaccinations: 0, submissions: 50, rec: 'ecowas' },
    { code: 'GH', name: 'Ghana', outbreaks: 40, cases: 0, deaths: 0, vaccinations: 0, submissions: 40, rec: 'ecowas' },
    { code: 'BF', name: 'Burkina Faso', outbreaks: 45, cases: 0, deaths: 0, vaccinations: 0, submissions: 45, rec: 'ecowas' },
    { code: 'ML', name: 'Mali', outbreaks: 35, cases: 0, deaths: 0, vaccinations: 0, submissions: 35, rec: 'ecowas' },
    { code: 'TD', name: 'Chad', outbreaks: 30, cases: 0, deaths: 0, vaccinations: 0, submissions: 30, rec: 'eccas' },
    { code: 'MZ', name: 'Mozambique', outbreaks: 42, cases: 0, deaths: 0, vaccinations: 0, submissions: 42, rec: 'sadc' },
    { code: 'SD', name: 'Sudan', outbreaks: 38, cases: 0, deaths: 0, vaccinations: 0, submissions: 38, rec: 'igad' },
    { code: 'SO', name: 'Somalia', outbreaks: 25, cases: 0, deaths: 0, vaccinations: 0, submissions: 25, rec: 'igad' },
    { code: 'CM', name: 'Cameroon', outbreaks: 55, cases: 0, deaths: 0, vaccinations: 0, submissions: 55, rec: 'eccas' },
    { code: 'NA', name: 'Namibia', outbreaks: 85, cases: 0, deaths: 0, vaccinations: 0, submissions: 85, rec: 'sadc' },
    { code: 'ZM', name: 'Zambia', outbreaks: 58, cases: 0, deaths: 0, vaccinations: 0, submissions: 58, rec: 'sadc' },
  ];

  const rankings = [
    { rank: 1, country: 'South Africa', rec: 'SADC', readiness: 90, status: 'ready' },
    { rank: 2, country: 'Botswana', rec: 'SADC', readiness: 88, status: 'ready' },
    { rank: 3, country: 'Kenya', rec: 'IGAD', readiness: 85, status: 'ready' },
    { rank: 4, country: 'Nigeria', rec: 'ECOWAS', readiness: 75, status: 'partial' },
    { rank: 5, country: 'Tanzania', rec: 'SADC', readiness: 70, status: 'partial' },
    { rank: 6, country: 'Senegal', rec: 'ECOWAS', readiness: 65, status: 'partial' },
    { rank: 7, country: 'Ethiopia', rec: 'IGAD', readiness: 55, status: 'priority' },
    { rank: 8, country: 'Chad', rec: 'ECCAS', readiness: 30, status: 'priority' },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="rounded-xl bg-[#1a3a4a] px-6 py-4 text-white">
        <h1 className="text-xl font-bold">PPR Programme Performance Dashboard</h1>
        <p className="text-sm text-white/60">AU-IBAR | Continental Delivery Platform for PPR Eradication</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <span className="rounded-full border border-white/20 px-3 py-0.5 text-xs">Programme period: 2024–2026</span>
          <span className="rounded-full border border-white/20 px-3 py-0.5 text-xs">Reporting period: 2026</span>
          <span className="rounded-full border border-white/20 px-3 py-0.5 text-xs">Region: All</span>
        </div>
      </div>

      {/* ── Row 1: 6 KPI Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiTarget icon={Activity} title="PPR Prevalence" baseline="75%" target="0%" status="on_watch" color="#EA580C" />
        <KpiTarget icon={Shield} title="WOAH Free Countries" baseline={6} target={49} status="behind" color="#DC2626" />
        <KpiTarget icon={Users} title="Countries Ready" baseline={0} target={48} status="in_progress" color="#059669" />
        <KpiTarget icon={Database} title="Data Systems" baseline={0} target={15} status="on_track" color="#0891B2" />
        <KpiTarget icon={FlaskConical} title="Lab Capacity" baseline={0} target="25 labs" status="in_progress" color="#7C3AED" />
        <KpiTarget icon={Syringe} title="Vaccine Readiness" baseline="" target="System readiness" status="in_progress" color="#1F4E79" />
      </div>

      {/* ── Row 2: Map + Ranking ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Map */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Africa Readiness Map</h3>
            <p className="text-[10px] text-gray-400">Countries colored by readiness to implement PPR eradication</p>
          </div>
          <div className="h-[350px]">
            <ChoroplethMap title="Africa Readiness Map" data={mapData} indicator="submissions" bare />
          </div>
          <div className="flex gap-4 px-5 py-2 border-t border-gray-100 dark:border-gray-700">
            {[
              { color: '#22c55e', label: 'Ready' },
              { color: '#f59e0b', label: 'Partial' },
              { color: '#ef4444', label: 'Priority' },
              { color: '#d1d5db', label: 'No data' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: l.color }} />
                <span className="text-[10px] text-gray-500">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ranking Table */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Country Readiness Ranking</h3>
            <button className="rounded-md bg-[#0891B2] px-3 py-1 text-[10px] font-medium text-white hover:bg-[#0e7490]">
              View full ranking
            </button>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#1a3a4a] text-white text-[10px] font-semibold uppercase tracking-wide">
                <th className="py-2 pl-3 rounded-tl">#</th>
                <th className="py-2">Country</th>
                <th className="py-2">REC</th>
                <th className="py-2">Readiness</th>
                <th className="py-2 pr-3 text-right rounded-tr">Status</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((r) => (
                <RankingRow key={r.rank} {...r} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Row 3: Governance + Risks + Actions ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Governance & Coordination */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-[#1a3a4a]" />
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Governance & Coordination</h3>
          </div>
          <div className="space-y-3">
            <HBar label="Governance structure" value={75} color="#059669" />
            <HBar label="Technical coordination" value={60} color="#1F4E79" />
            <HBar label="Stakeholder platforms" value={70} color="#059669" />
            <HBar label="Resource mobilization" value={35} color="#DC2626" />
          </div>
          <p className="mt-3 text-[10px] text-[#0891B2] font-medium cursor-pointer hover:underline">View details →</p>
        </div>

        {/* Top Risks */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Top Risks</h3>
          </div>
          <div className="space-y-3">
            {[
              'Countries with weak surveillance/data systems',
              'Delays in vaccine delivery partnerships',
              'Incomplete WOAH disease-free evidence',
              'Coordination platforms not yet fully operational',
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">{i + 1}</span>
                <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{text}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-[#0891B2] font-medium cursor-pointer hover:underline">View all risks →</p>
        </div>

        {/* Management Actions */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Management Actions</h3>
          </div>
          <div className="space-y-3">
            {[
              'Prioritize support to red countries',
              'Finalize resource mobilization package',
              'Accelerate AU-PANVAC capacity package',
              'Follow up on missing surveillance reports',
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1a3a4a]" />
                <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{text}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-[#0891B2] font-medium cursor-pointer hover:underline">View action tracker →</p>
        </div>
      </div>

      {/* ── Row 4: 4 Capacity Gauges ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <GaugeCircle value={58} label="Surveillance & Data" color="#0891B2" delta="▲ 8 pts vs 2026" />
        <GaugeCircle value={42} label="Laboratory Capacity" color="#7C3AED" delta="▲ 6 pts vs 2026" />
        <GaugeCircle value={46} label="Vaccination System" color="#059669" delta="▲ 5 pts vs 2026" />
        <GaugeCircle value={52} label="Evidence & Reporting" color="#EA580C" delta="▲ 7 pts vs 2026" />
      </div>
    </div>
  );
}
