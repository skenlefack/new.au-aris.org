'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDomainStore, type Domain, type SubDomain, type SubDomainType } from '@/lib/stores/domain-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import dynamic from 'next/dynamic';
import { DashboardSection } from '@/components/domain/DashboardSection';
import { PlanningsSection } from '@/components/domain/PlanningsSection';
import type { DashboardScope } from '@/lib/api/dashboard-hooks';
import { useTranslations } from '@/lib/i18n/translations';

const PPRPerformanceDashboard = dynamic(
  () => import('@/components/collecte/PPRPerformanceDashboard'),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" /> },
);

const PPRAnnualDashboard = dynamic(
  () => import('@/components/collecte/PPRAnnualDashboard'),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" /> },
);

const PPRFrameworkDashboard = dynamic(
  () => import('@/components/collecte/PPRFrameworkDashboard'),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" /> },
);

/* ── Type badge config ──────────────────────────────── */

const TYPE_BADGE_CLASSES: Record<SubDomainType, string> = {
  VALUE_CHAIN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  ORGANIZATIONAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PATHOLOGY: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  OTHER: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
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

function PPRDashboardTabs() {
  const t = useTranslations('domain');
  const [activeTab, setActiveTab] = useState<'performance' | 'annual' | 'framework'>('performance');
  const tabs = [
    { key: 'performance' as const, label: t('pprPerformance'), icon: '📊' },
    { key: 'annual' as const, label: t('pprAnnual'), icon: '📋' },
    { key: 'framework' as const, label: t('pprFramework'), icon: '🗂️' },
  ];
  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'performance' && <PPRPerformanceDashboard />}
      {activeTab === 'annual' && <PPRAnnualDashboard />}
      {activeTab === 'framework' && <PPRFrameworkDashboard />}
    </div>
  );
}

export default function SubDomainPage() {
  const t = useTranslations('domain');
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
  const typeEnum = subDomain?.typeEnum ?? 'OTHER';
  const typeBadgeClasses = TYPE_BADGE_CLASSES[typeEnum];
  const TYPE_BADGE_LABELS: Record<SubDomainType, string> = {
    VALUE_CHAIN: t('typeValueChain'),
    ORGANIZATIONAL: t('typeOrganizational'),
    PATHOLOGY: t('typePathology'),
    OTHER: t('typeOther'),
  };
  const typeBadgeLabel = TYPE_BADGE_LABELS[typeEnum];

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
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', typeBadgeClasses)}>
                  {typeBadgeLabel}
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
      {subCode === 'PPR' ? (
        <PPRDashboardTabs />
      ) : (
        <DashboardSection
          scope={scope}
          target={{ subDomainId: subDomain?.id }}
          domainCode={domainCode}
        />
      )}

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
                {t('valueCrossTitle')}
              </h3>
              <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                {t('valueCrossDesc', { code: subDomain.valueChainCode })}
              </p>
            </div>
            <Link
              href={`/value-chains/${subDomain.valueChainCode}`}
              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              {t('valueCrossExplore')} <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
