'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { useDomainStore, type Domain } from '@/lib/stores/domain-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { DashboardSection } from '@/components/domain/DashboardSection';
import { PlanningsSection } from '@/components/domain/PlanningsSection';
import { SubDomainsGrid } from '@/components/domain/SubDomainsGrid';
import type { DashboardScope } from '@/lib/api/dashboard-hooks';

/* ── Domain metadata for colors / descriptions ─────────── */

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

function resolveScope(role?: string, tenantLevel?: string): DashboardScope {
  if (role === 'SUPER_ADMIN' || role === 'CONTINENTAL_ADMIN') return 'CONTINENTAL';
  if (role === 'REC_ADMIN') return 'REC';
  if (tenantLevel === 'CONTINENTAL') return 'CONTINENTAL';
  if (tenantLevel === 'REC') return 'REC';
  return 'COUNTRY';
}

export default function DomainPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  const allDomains = useDomainStore((s) => s.allDomains);
  const userDomains = useDomainStore((s) => s.userDomains);
  const user = useAuthStore((s) => s.user);

  // Find domain in store
  const domain: Domain | undefined =
    allDomains.find((d) => d.code === code) ??
    userDomains.find((d) => d.code === code);

  const meta = DOMAIN_META[code] ?? { color: '#1F4E79', description: '' };
  const domainName =
    domain?.name?.en ?? domain?.name?.fr ?? code.replace(/-/g, ' ');
  const scope = resolveScope(user?.role, user?.tenantLevel);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/" className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300">
          <Home className="h-3.5 w-3.5" />
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-gray-900 dark:text-white capitalize">
          {domainName}
        </span>
      </nav>

      {/* Header */}
      <div
        className="rounded-xl border p-6"
        style={{
          borderColor: `${meta.color}30`,
          background: `linear-gradient(135deg, ${meta.color}08 0%, transparent 60%)`,
        }}
      >
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
      </div>

      {/* SECTION 1: Dashboard */}
      <DashboardSection
        scope={scope}
        target={{ domainId: domain?.id }}
        domainCode={code}
      />

      {/* SECTION 2: Planifications */}
      <PlanningsSection target={{ domainCode: code }} />

      {/* SECTION 3: Sous-domaines */}
      <SubDomainsGrid domainCode={code} />
    </div>
  );
}
