'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDomainStore, type Domain, type SubDomain, type SubDomainType } from '@/lib/stores/domain-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { DashboardSection } from '@/components/domain/DashboardSection';
import { PlanningsSection } from '@/components/domain/PlanningsSection';
import type { DashboardScope } from '@/lib/api/dashboard-hooks';

/* ── Type badge config ──────────────────────────────── */

const TYPE_BADGES: Record<SubDomainType, { label: string; classes: string }> = {
  VALUE_CHAIN: {
    label: 'Chaine de valeur',
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  ORGANIZATIONAL: {
    label: 'Organisationnel',
    classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  PATHOLOGY: {
    label: 'Pathologie',
    classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  OTHER: {
    label: 'Autre',
    classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  },
};

const DOMAIN_COLORS: Record<string, string> = {
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

function resolveScope(role?: string, tenantLevel?: string): DashboardScope {
  if (role === 'SUPER_ADMIN' || role === 'CONTINENTAL_ADMIN') return 'CONTINENTAL';
  if (role === 'REC_ADMIN') return 'REC';
  if (tenantLevel === 'CONTINENTAL') return 'CONTINENTAL';
  if (tenantLevel === 'REC') return 'REC';
  return 'COUNTRY';
}

export default function SubDomainPage() {
  const params = useParams<{ code: string; sub: string }>();
  const domainCode = params.code;
  const subCode = params.sub;

  const allDomains = useDomainStore((s) => s.allDomains);
  const userDomains = useDomainStore((s) => s.userDomains);
  const subDomainsMetadata = useDomainStore((s) => s.subDomainsMetadata);
  const user = useAuthStore((s) => s.user);

  // Find domain
  const domain: Domain | undefined =
    allDomains.find((d) => d.code === domainCode) ??
    userDomains.find((d) => d.code === domainCode);

  // Find sub-domain
  const subDomain: SubDomain | undefined = subDomainsMetadata.find(
    (sd) => sd.domainCode === domainCode && sd.code === subCode,
  );

  const domainName =
    domain?.name?.en ?? domain?.name?.fr ?? domainCode.replace(/-/g, ' ');
  const subDomainName = subDomain?.labelEn || subDomain?.labelFr || subCode.replace(/-/g, ' ');
  const color = DOMAIN_COLORS[domainCode] ?? '#1F4E79';
  const scope = resolveScope(user?.role, user?.tenantLevel);
  const typeBadge = TYPE_BADGES[subDomain?.typeEnum ?? 'OTHER'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-xl border p-6"
        style={{
          borderColor: `${color}30`,
          background: `linear-gradient(135deg, ${color}08 0%, transparent 60%)`,
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-white text-lg font-bold"
              style={{ backgroundColor: color }}
            >
              {subDomainName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {subDomainName}
              </h1>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', typeBadge.classes)}>
                  {typeBadge.label}
                </span>
                {subDomain?.valueChainCode && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {subDomain.valueChainCode}
                  </span>
                )}
              </div>
              {subDomain?.description && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {subDomain.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Dashboard */}
      <DashboardSection
        scope={scope}
        target={{ subDomainId: subDomain?.id }}
        domainCode={domainCode}
      />

      {/* SECTION 2: Planifications */}
      <PlanningsSection
        target={{ domainCode, subDomainCode: subCode }}
      />

      {/* BONUS: Value chain cross-domain link */}
      {subDomain?.typeEnum === 'VALUE_CHAIN' && subDomain.valueChainCode && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                Vue transverse de la chaine de valeur
              </h3>
              <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                Voir tous les sous-domaines lies a la chaine &quot;{subDomain.valueChainCode}&quot; a travers les domaines
              </p>
            </div>
            <Link
              href={`/value-chains/${subDomain.valueChainCode}`}
              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              Explorer <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
