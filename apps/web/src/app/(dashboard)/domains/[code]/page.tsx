'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { useDomainStore, type Domain } from '@/lib/stores/domain-store';
import { useDomainSummary } from '@/lib/api/domain-summary-hooks';
import { DomainKpiBar } from '@/components/domain/DomainKpiBar';
import { DomainSynthesis } from '@/components/domain/DomainSynthesis';
import { DomainActivityFeed } from '@/components/domain/DomainActivityFeed';
import { PlanningsSection } from '@/components/domain/PlanningsSection';
import { SubDomainsGrid } from '@/components/domain/SubDomainsGrid';

/* -- Domain metadata for colors / descriptions -- */

const DOMAIN_META: Record<string, { color: string; description: string }> = {
  'animal-health': {
    color: '#C62828',
    description: 'Surveillance, outbreaks, laboratory, vaccination, AMR',
  },
  'livestock-prod': {
    color: '#E65100',
    description: 'Census, production systems, transhumance corridors',
  },
  fisheries: {
    color: '#0277BD',
    description: 'Captures, fleet, licenses, aquaculture, aquatic health',
  },
  'trade-sps': {
    color: '#2E7D32',
    description: 'Trade flows, SPS certification, market intelligence',
  },
  governance: {
    color: '#4527A0',
    description: 'Legal frameworks, veterinary capacities, PVS metrics',
  },
  wildlife: {
    color: '#795548',
    description: 'Inventories, protected areas, CITES, human-wildlife conflict',
  },
  apiculture: {
    color: '#F9A825',
    description: 'Apiaries, honey production, colony health',
  },
  'climate-env': {
    color: '#00695C',
    description: 'Water stress, rangelands, GHG, vulnerability hotspots',
  },
  'knowledge-hub': {
    color: '#1565C0',
    description: 'Portal, e-repository, briefs, monitoring & evaluation',
  },
};

/* ── Loading Skeleton ── */

function DomainLoadingSkeleton({ color, name }: { color: string; name: string }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header skeleton */}
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: `${color}30`, background: `linear-gradient(135deg, ${color}08 0%, transparent 60%)` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-white text-lg font-bold"
            style={{ backgroundColor: color }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">{name}</h1>
            <div className="mt-1.5 h-3.5 w-56 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      </div>

      {/* KPI bar skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-xl" style={{ backgroundColor: `${color}15` }} />
              <div className="flex-1 space-y-2">
                <div className="h-6 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Synthesis skeleton — map + charts */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 h-[320px] animate-pulse rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 rounded-xl animate-pulse" style={{ backgroundColor: `${color}20` }} />
              <p className="mt-2 text-xs text-gray-400">Loading map...</p>
            </div>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="h-[150px] animate-pulse rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50" />
          <div className="h-[150px] animate-pulse rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50" />
        </div>
      </div>

      {/* Sub-domains skeleton */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50" />
        ))}
      </div>

      {/* Plannings skeleton */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-50 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DomainPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  const allDomains = useDomainStore((s) => s.allDomains);
  const userDomains = useDomainStore((s) => s.userDomains);

  const domain: Domain | undefined =
    allDomains.find((d) => d.code === code) ??
    userDomains.find((d) => d.code === code);

  const meta = DOMAIN_META[code] ?? { color: '#1F4E79', description: '' };
  const domainName =
    domain?.name?.en ?? domain?.name?.fr ?? code.replace(/-/g, ' ');

  const { data: summaryRes, isLoading } = useDomainSummary(code);
  const summary = summaryRes?.data ?? null;

  // Show full-page skeleton on initial load
  if (isLoading && !summary) {
    return <DomainLoadingSkeleton color={meta.color} name={domainName} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div
        className="rounded-xl border p-6"
        style={{
          borderColor: `${meta.color}30`,
          background: `linear-gradient(135deg, ${meta.color}08 0%, transparent 60%)`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-white text-lg font-bold"
              style={{ backgroundColor: meta.color }}
            >
              {domainName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                {domainName}
              </h1>
              {meta.description && (
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {meta.description}
                </p>
              )}
            </div>
          </div>
          <Link
            href={`/my-dashboards?domain=${code}`}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboards avances
          </Link>
        </div>
      </div>

      {/* KPI Bar */}
      <DomainKpiBar kpis={summary?.kpis ?? null} loading={isLoading} />

      {/* Visual Synthesis -- Map, Trend, Breakdown */}
      <DomainSynthesis synthesis={summary?.synthesis ?? null} loading={isLoading} domainColor={meta.color} />

      {/* Sub-domains Grid */}
      <SubDomainsGrid domainCode={code} />

      {/* Plannings */}
      <PlanningsSection target={{ domainCode: code }} />

      {/* Recent Activity */}
      <DomainActivityFeed activities={summary?.recentActivity ?? null} loading={isLoading} domainColor={meta.color} />
    </div>
  );
}
