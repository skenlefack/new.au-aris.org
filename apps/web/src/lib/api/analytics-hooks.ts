// React Query hooks for the Analytics service (services/analytics, port 3030).
//
// Covers zone-level KPI aggregation and other analytics queries that do not
// belong to the dashboard-builder flow (see dashboard-hooks.ts for that).

import { useQuery } from '@tanstack/react-query';
import { analyticsClient } from './client';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ZoneKpis {
  zoneId: string;
  totalSubmissions: number;
  activeTenants: number;
  memberBreakdown: Array<{ admin1Id: string; count: number }>;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch aggregated KPIs for a geographic zone.
 *
 * @param zoneId  UUID of the geo zone (geo_zone_id in submissions table).
 * @param memberIds  Optional list of Admin1 UUIDs that belong to the zone.
 *                   Pass these when the zone is not stored as geo_zone_id on
 *                   submissions but the admin_location.level_1 field is used
 *                   instead (or alongside it).
 */
export function useZoneKpis(zoneId?: string, memberIds?: string[]) {
  const params: Record<string, string> = {};
  if (memberIds && memberIds.length > 0) {
    params.memberIds = memberIds.join(',');
  }

  return useQuery<{ data: ZoneKpis }>({
    queryKey: ['zone-kpis', zoneId, memberIds],
    queryFn: () =>
      analyticsClient.get<{ data: ZoneKpis }>(
        `/analytics/zones/${zoneId}/kpis`,
        Object.keys(params).length > 0 ? params : undefined,
      ),
    enabled: !!zoneId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
