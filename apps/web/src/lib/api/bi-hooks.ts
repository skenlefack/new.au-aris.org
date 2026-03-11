'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const TENANT_API =
  process.env.NEXT_PUBLIC_TENANT_API_URL ?? '/api/v1';

/* ── Types ── */

export interface BiToolConfig {
  id: string;
  tool: string;
  baseUrl: string;
  displayName: Record<string, string>;
  description?: Record<string, string>;
  icon?: string;
  status: 'active' | 'coming_soon' | 'maintenance' | 'disabled';
  embedMode: 'iframe' | 'guest_token' | 'signed_url';
  sortOrder: number;
}

export interface BiAccessRule {
  id: string;
  biToolConfigId: string;
  tool?: string;
  roleLevel?: string;
  entityType?: string;
  entityId?: string;
  allowedSchemas: string[];
  allowedTables: string[];
  excludedTables: string[];
  dataFilters?: Record<string, unknown>;
  canCreateDashboard: boolean;
  canExportData: boolean;
  canUseSqlLab: boolean;
  isActive: boolean;
}

export interface BiDashboard {
  id: string;
  tool: string;
  externalId: string;
  name: Record<string, string>;
  description?: Record<string, string>;
  thumbnail?: string;
  category?: string;
  embedUrl: string;
  scope: string;
  allowedRoles: string[];
  sortOrder: number;
  isFeatured: boolean;
  isActive: boolean;
}

/* ── Fallback data (used when backend is not available) ── */

const FALLBACK_TOOLS: BiToolConfig[] = [
  {
    id: 'superset',
    tool: 'superset',
    baseUrl: process.env.NEXT_PUBLIC_SUPERSET_URL ?? '/api/bi-proxy/superset',
    displayName: { en: 'Apache Superset', fr: 'Apache Superset' },
    description: {
      en: 'Advanced analytics and data exploration platform',
      fr: "Plateforme d'analyses avancees et d'exploration de donnees",
    },
    icon: 'Layers',
    status: 'active',
    embedMode: 'guest_token',
    sortOrder: 1,
  },
  {
    id: 'metabase',
    tool: 'metabase',
    baseUrl: process.env.NEXT_PUBLIC_METABASE_URL ?? '/api/bi-proxy/metabase',
    displayName: { en: 'Metabase', fr: 'Metabase' },
    description: {
      en: 'Simple and intuitive business intelligence tool',
      fr: 'Outil de BI simple et intuitif',
    },
    icon: 'PieChart',
    status: 'active',
    embedMode: 'iframe',
    sortOrder: 2,
  },
  {
    id: 'grafana',
    tool: 'grafana',
    baseUrl: process.env.NEXT_PUBLIC_GRAFANA_URL ?? '/api/bi-proxy/grafana',
    displayName: { en: 'Grafana', fr: 'Grafana' },
    description: {
      en: 'Dashboard builder with PostgreSQL queries, variables, and alerting',
      fr: 'Constructeur de tableaux de bord avec requetes PostgreSQL, variables et alertes',
    },
    icon: 'BarChart2',
    status: 'active',
    embedMode: 'iframe',
    sortOrder: 3,
  },
];

/* ── Helpers ── */

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window === 'undefined') return headers;
  try {
    const raw = localStorage.getItem('aris-auth');
    if (raw) {
      const token = JSON.parse(raw)?.state?.accessToken;
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const tenant = localStorage.getItem('aris-tenant');
    if (tenant) {
      const tid = JSON.parse(tenant)?.state?.selectedTenantId;
      if (tid) headers['X-Tenant-Id'] = tid;
    }
  } catch { /* ignore */ }
  return headers;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${TENANT_API}${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init?.headers as Record<string, string> ?? {}) },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

/* ── Hooks — Tool Configs ── */

export function useBiTools() {
  return useQuery({
    queryKey: ['bi', 'tools'],
    queryFn: async () => {
      try {
        return await apiFetch<{ data: BiToolConfig[] }>('/bi/tools');
      } catch {
        return { data: FALLBACK_TOOLS };
      }
    },
    staleTime: 10 * 60_000,
  });
}

export function useBiTool(tool: string) {
  return useQuery({
    queryKey: ['bi', 'tool', tool],
    queryFn: async () => {
      try {
        return await apiFetch<{ data: BiToolConfig }>(`/bi/tools/${tool}`);
      } catch {
        const found = FALLBACK_TOOLS.find((t) => t.tool === tool);
        return { data: found || null };
      }
    },
    enabled: !!tool,
    staleTime: 10 * 60_000,
  });
}

export function useBiEmbedUrl(tool: string) {
  return useQuery({
    queryKey: ['bi', 'embed', tool],
    queryFn: async () => {
      try {
        return await apiFetch<{ data: { url: string | null; guestToken: string | null } }>(
          `/bi/tools/${tool}/embed-url`,
        );
      } catch {
        // Fallback
        const config = FALLBACK_TOOLS.find((t) => t.tool === tool);
        if (!config || config.status !== 'active') {
          return { data: { url: null, guestToken: null } };
        }
        const url = config.baseUrl;
        return { data: { url, guestToken: null } };
      }
    },
    enabled: !!tool,
    staleTime: 5 * 60_000,
  });
}

/* ── Hooks — Dashboards ── */

export function useBiDashboards(tool?: string) {
  return useQuery({
    queryKey: ['bi', 'dashboards', tool],
    queryFn: async () => {
      try {
        const params = tool ? `?tool=${tool}` : '';
        return await apiFetch<{ data: BiDashboard[] }>(`/bi/dashboards${params}`);
      } catch {
        return { data: [] as BiDashboard[] };
      }
    },
    staleTime: 5 * 60_000,
  });
}

/* ── Hooks — Access Rules ── */

export function useBiAccessRules(tool?: string) {
  return useQuery({
    queryKey: ['bi', 'access-rules', tool],
    queryFn: async () => {
      try {
        const params = tool ? `?tool=${tool}` : '';
        return await apiFetch<{ data: BiAccessRule[] }>(`/bi/access-rules${params}`);
      } catch {
        return { data: [] as BiAccessRule[] };
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useBiAccessRulesForRole(role: string, tool?: string) {
  return useQuery({
    queryKey: ['bi', 'access-rules', 'role', role, tool],
    queryFn: async () => {
      try {
        const params = tool ? `?tool=${tool}` : '';
        return await apiFetch<{ data: BiAccessRule[] }>(`/bi/access-rules/role/${role}${params}`);
      } catch {
        return { data: [] as BiAccessRule[] };
      }
    },
    enabled: !!role,
    staleTime: 5 * 60_000,
  });
}

export function useUpsertBiAccessRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      biToolConfigId: string;
      roleLevel: string;
      allowedSchemas: string[];
      allowedTables: string[];
      excludedTables: string[];
      canCreateDashboard: boolean;
      canExportData: boolean;
      canUseSqlLab: boolean;
      dataFilters?: Record<string, unknown>;
    }) => {
      return apiFetch<{ data: { id: string } }>('/bi/access-rules', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bi', 'access-rules'] });
    },
  });
}

/* ── Hooks — Superset Guest Token ── */

export function useRequestSupersetGuestToken() {
  return useMutation({
    mutationFn: async (params: { dashboardId: string }) => {
      return apiFetch<{ data: { guestToken: string } }>('/bi/superset/guest-token', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
  });
}

/* ── Hooks — Metabase Session ── */

export function useRequestMetabaseSession() {
  return useMutation({
    mutationFn: async () => {
      return apiFetch<{ data: { sessionToken: string } }>('/bi/metabase/session', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
  });
}

/* ── Hooks — Grafana Embed URL ── */

export function useGrafanaEmbedUrl(dashboardUid?: string) {
  return useQuery({
    queryKey: ['bi', 'grafana', 'embed-url', dashboardUid],
    queryFn: async () => {
      try {
        const params = dashboardUid ? `?dashboardUid=${dashboardUid}` : '';
        return await apiFetch<{ data: { url: string } }>(`/bi/grafana/embed-url${params}`);
      } catch {
        return { data: { url: '/api/bi-proxy/grafana/?kiosk' } };
      }
    },
    staleTime: 5 * 60_000,
  });
}
