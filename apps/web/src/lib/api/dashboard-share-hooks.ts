'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsClient, apiClient } from './client';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ShareRecord {
  id: string;
  dashboard_id: string;
  shared_with_user_id: string | null;
  shared_with_role: string | null;
  shared_with_tenant_id: string | null;
  is_public: boolean;
  permission: 'VIEW' | 'CLONE';
  share_type: 'USER' | 'ROLE' | 'COUNTRY' | 'REC' | 'PUBLIC';
  share_label: string | null;
  expires_at: string | null;
  status: string;
  created_by: string;
  created_at: string;
}

export interface CreateShareInput {
  dashboardId: string;
  shareType: 'USER' | 'ROLE' | 'COUNTRY' | 'REC' | 'PUBLIC';
  sharedWithUserId?: string;
  sharedWithRole?: string;
  sharedWithTenantId?: string;
  permission: 'VIEW' | 'CLONE';
  shareLabel?: string;
  expiresAt?: string;
}

export interface UpdateShareInput {
  shareId: string;
  dashboardId: string;
  permission?: 'VIEW' | 'CLONE';
  expiresAt?: string | null;
}

export interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  tenantId: string;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

const SHARE_KEYS = {
  shares: (id: string) => ['dashboard-shares', id] as const,
  userSearch: (q: string) => ['user-search', q] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

/** List active shares for a dashboard */
export function useDashboardShares(dashboardId: string) {
  return useQuery<{ data: ShareRecord[] }>({
    queryKey: SHARE_KEYS.shares(dashboardId),
    queryFn: () =>
      analyticsClient.get<{ data: ShareRecord[] }>(
        `/analytics/dashboards/${dashboardId}/shares`,
      ),
    enabled: !!dashboardId,
  });
}

/** Search users for autocomplete (debounced in the component) */
export function useSearchUsers(query: string) {
  return useQuery<{ data: UserSearchResult[] }>({
    queryKey: SHARE_KEYS.userSearch(query),
    queryFn: () =>
      apiClient.get<{ data: UserSearchResult[] }>(
        '/credential/users',
        { search: query, limit: '20' },
      ),
    enabled: query.length >= 2,
    staleTime: 30_000, // 30s — user lists don't change often
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Create a new share */
export function useShareDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dashboardId, ...body }: CreateShareInput) =>
      analyticsClient.post<{ data: ShareRecord }>(
        `/analytics/dashboards/${dashboardId}/shares`,
        body,
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: SHARE_KEYS.shares(vars.dashboardId) });
    },
  });
}

/** Update a share (permission, expiry) */
export function useUpdateShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dashboardId, shareId, ...body }: UpdateShareInput) =>
      analyticsClient.patch<{ data: ShareRecord }>(
        `/analytics/dashboards/${dashboardId}/shares/${shareId}`,
        body,
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: SHARE_KEYS.shares(vars.dashboardId) });
    },
  });
}

/** Revoke a share (PATCH status=REVOKED) */
export function useRevokeShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      dashboardId,
      shareId,
    }: {
      dashboardId: string;
      shareId: string;
    }) =>
      analyticsClient.patch<{ data: ShareRecord }>(
        `/analytics/dashboards/${dashboardId}/shares/${shareId}`,
        { status: 'REVOKED' },
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: SHARE_KEYS.shares(vars.dashboardId) });
    },
  });
}
