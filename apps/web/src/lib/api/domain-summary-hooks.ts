'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsClient } from './client';

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

export function useDomainSummary(domainCode: string) {
  return useQuery<{ data: DomainSummary }>({
    queryKey: ['domain-summary', domainCode],
    queryFn: () =>
      analyticsClient.get<{ data: DomainSummary }>(
        `/analytics/domains/${domainCode}/summary`,
      ),
    staleTime: 2 * 60 * 1000,
    enabled: !!domainCode,
  });
}
