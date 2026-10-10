'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsClient } from './client';
import { withDashboardCache } from '@/lib/offline/query-offline';

export interface DomainSummary {
  kpis: {
    totalSubmissions: number;
    activeCountries: number;
    activeCampaigns: number;
    completionRate: number;
    qualityScore: number;
    trend: { current: number; previous: number; delta: number };
  };
  synthesis: {
    countryDistribution: { code: string; name: string; count: number }[];
    monthlyTrend: { month: string; count: number }[];
    subDomainBreakdown: { code: string; label: string; count: number }[];
  };
  recentActivity: {
    type: 'submission' | 'validation' | 'campaign_start';
    country?: string;
    formName?: string;
    timestamp: string;
  }[];
}

function _tid(): string {
  try { const r = localStorage.getItem('aris-tenant'); return r ? JSON.parse(r)?.state?.selectedTenantId ?? '' : ''; } catch { return ''; }
}

export function useDomainSummary(domainCode: string) {
  const tenantId = typeof window !== 'undefined' ? _tid() : '';
  return useQuery<{ data: DomainSummary }>({
    queryKey: ['domain-summary', domainCode],
    queryFn: withDashboardCache(
      `/analytics/domains/${domainCode}/summary`,
      tenantId,
      () => analyticsClient.get<{ data: DomainSummary }>(
        `/analytics/domains/${domainCode}/summary`,
      ),
    ),
    staleTime: 2 * 60 * 1000,
    enabled: !!domainCode,
    networkMode: 'offlineFirst',
  });
}
