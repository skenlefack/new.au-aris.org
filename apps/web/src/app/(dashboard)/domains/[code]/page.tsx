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

  return (
    <div className="space-y-6">
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

      {/* Recent Activity */}
      <DomainActivityFeed activities={summary?.recentActivity ?? null} loading={isLoading} />

      {/* Plannings */}
      <PlanningsSection target={{ domainCode: code }} />
    </div>
  );
}
