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
import { usePageReady } from '@/components/ui/PageLoader';
import { useLocaleStore } from '@/lib/stores/locale-store';

/* -- Fallback domain colors (used when API domain doesn't have color) -- */

const DOMAIN_FALLBACK_COLORS: Record<string, string> = {
  'animal-health': '#C62828',
  'livestock-prod': '#E65100',
  fisheries: '#0277BD',
  'trade-sps': '#2E7D32',
  governance: '#4527A0',
  wildlife: '#795548',
  apiculture: '#F9A825',
  'climate-env': '#00695C',
  'knowledge-hub': '#1565C0',
};

export default function DomainPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  const allDomains = useDomainStore((s) => s.allDomains);
  const userDomains = useDomainStore((s) => s.userDomains);

  const domain: Domain | undefined =
    allDomains.find((d) => d.code === code) ??
    userDomains.find((d) => d.code === code);

  const locale = useLocaleStore((s) => s.locale);
  const domainColor = domain?.color || DOMAIN_FALLBACK_COLORS[code] || '#1F4E79';
  const domainName =
    domain?.name?.[locale] ?? domain?.name?.en ?? domain?.name?.fr ?? code.replace(/-/g, ' ');

  const { data: summaryRes, isLoading } = useDomainSummary(code);
  const summary = summaryRes?.data ?? null;

  // Signal to the route-change loader that the page is ready
  usePageReady(!isLoading);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header — renders instantly, no API dependency */}
      <div
        className="rounded-xl border p-6"
        style={{
          borderColor: `${domainColor}30`,
          background: `linear-gradient(135deg, ${domainColor}08 0%, transparent 60%)`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-white text-lg font-bold"
              style={{ backgroundColor: domainColor }}
            >
              {domainName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                {domainName}
              </h1>
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

      {/* KPI Bar — has built-in loading skeleton */}
      <DomainKpiBar kpis={summary?.kpis ?? null} loading={isLoading} />

      {/* Visual Synthesis — has built-in loading skeleton */}
      <DomainSynthesis synthesis={summary?.synthesis ?? null} loading={isLoading} domainColor={domainColor} />

      {/* Sub-domains Grid — fetches its own data independently */}
      <SubDomainsGrid domainCode={code} />

      {/* Plannings — fetches its own data independently */}
      <PlanningsSection target={{ domainCode: code }} />

      {/* Recent Activity — has built-in loading skeleton */}
      <DomainActivityFeed activities={summary?.recentActivity ?? null} loading={isLoading} domainColor={domainColor} />
    </div>
  );
}
