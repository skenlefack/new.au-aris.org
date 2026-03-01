'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from './client';

const TENANT_API = process.env['NEXT_PUBLIC_TENANT_API_URL'] ?? 'http://localhost:3001';

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

async function handleTenantResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: any;
    try { body = await res.json(); } catch { /* non-json */ }
    throw new ApiClientError(res.status, body?.message ?? `Request failed: ${res.status}`, body?.errors);
  }
  return res.json();
}

async function tenantFetch<T = any>(path: string): Promise<T> {
  const res = await fetch(`${TENANT_API}${path}`, { headers: getAuthHeaders() });
  return handleTenantResponse<T>(res);
}

async function tenantPost<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${TENANT_API}${path}`, {
    method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
  });
  return handleTenantResponse<T>(res);
}

async function tenantPut<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${TENANT_API}${path}`, {
    method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(body),
  });
  return handleTenantResponse<T>(res);
}

async function tenantPatch<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${TENANT_API}${path}`, {
    method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(body),
  });
  return handleTenantResponse<T>(res);
}

async function tenantDelete<T = any>(path: string): Promise<T> {
  const res = await fetch(`${TENANT_API}${path}`, {
    method: 'DELETE', headers: getAuthHeaders(),
  });
  return handleTenantResponse<T>(res);
}

// ── RECs ──

export function useSettingsRecs(params?: { search?: string; status?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams();
  qs.set('page', String(params?.page ?? 1));
  qs.set('limit', String(params?.limit ?? 10));
  if (params?.search) qs.set('search', params.search);
  if (params?.status) qs.set('status', params.status);
  const query = `?${qs.toString()}`;

  return useQuery({
    queryKey: ['settings', 'recs', params],
    queryFn: () => tenantFetch(`/api/v1/settings/recs${query}`),
    staleTime: 10 * 60_000,
  });
}

export function useSettingsRec(idOrCode: string) {
  return useQuery({
    queryKey: ['settings', 'recs', idOrCode],
    queryFn: () => tenantFetch(`/api/v1/settings/recs/${idOrCode}`),
    enabled: !!idOrCode,
    staleTime: 10 * 60_000,
  });
}

export function useCreateRec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => tenantPost('/api/v1/settings/recs', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'recs'] }),
  });
}

export function useUpdateRec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      tenantPut(`/api/v1/settings/recs/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'recs'] }),
  });
}

export function useDeleteRec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tenantDelete(`/api/v1/settings/recs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'recs'] }),
  });
}

export function useUpdateRecStats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stats }: { id: string; stats: Record<string, number> }) =>
      tenantPatch(`/api/v1/settings/recs/${id}/stats`, { stats }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'recs'] }),
  });
}

// ── Countries ──

export function useSettingsCountries(params?: { search?: string; recCode?: string; status?: string; operational?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams();
  qs.set('page', String(params?.page ?? 1));
  qs.set('limit', String(params?.limit ?? 10));
  if (params?.search) qs.set('search', params.search);
  if (params?.recCode) qs.set('recCode', params.recCode);
  if (params?.status) qs.set('status', params.status);
  if (params?.operational) qs.set('operational', params.operational);
  const query = `?${qs.toString()}`;

  return useQuery({
    queryKey: ['settings', 'countries', params],
    queryFn: async () => {
      try {
        return await tenantFetch(`/api/v1/settings/countries${query}`);
      } catch {
        // Fallback: build from static config
        let all = Object.values(COUNTRIES).map((c) => ({
          id: c.tenantId ?? c.code,
          code: c.code,
          name: { en: c.name, fr: c.nameFr, pt: c.name, ar: c.name },
          capital: { en: c.capital, fr: c.capital, pt: c.capital, ar: c.capital },
          flag: c.flag,
          population: Math.round(c.population * 1_000_000),
          recs: c.recs,
          isActive: true,
          isOperational: !!c.tenantId,
        }));
        // Apply filters
        if (params?.search) {
          const q = params.search.toLowerCase();
          all = all.filter((c) => c.name.en.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
        }
        if (params?.recCode) {
          all = all.filter((c) => c.recs.includes(params.recCode!));
        }
        // Sort by name
        all.sort((a, b) => a.name.en.localeCompare(b.name.en));
        const page = params?.page ?? 1;
        const limit = params?.limit ?? 10;
        const total = all.length;
        return { data: all.slice((page - 1) * limit, page * limit), meta: { total, page, limit } };
      }
    },
    staleTime: 10 * 60_000,
  });
}

export function useSettingsCountry(idOrCode: string) {
  return useQuery({
    queryKey: ['settings', 'countries', idOrCode],
    queryFn: async () => {
      try {
        return await tenantFetch(`/api/v1/settings/countries/${idOrCode}`);
      } catch {
        // Fallback: build from static config
        const c = COUNTRIES[idOrCode] ?? Object.values(COUNTRIES).find(
          (cc) => cc.tenantId === idOrCode || cc.code.toLowerCase() === idOrCode.toLowerCase(),
        );
        if (c) {
          return {
            data: {
              id: c.tenantId ?? c.code,
              code: c.code,
              name: { en: c.name, fr: c.nameFr, pt: c.name, ar: c.name },
              officialName: { en: c.name, fr: c.nameFr, pt: c.name, ar: c.name },
              capital: { en: c.capital, fr: c.capital, pt: c.capital, ar: c.capital },
              flag: c.flag,
              population: Math.round(c.population * 1_000_000),
              area: 0,
              timezone: c.timezone,
              languages: c.languages,
              currency: '',
              phoneCode: '',
              isActive: true,
              isOperational: !!c.tenantId,
              recs: c.recs,
              stats: {},
              sectorPerformance: { vaccination: 0, fisheries: 0, wildlife: 0, governance: 0, dataQuality: 0, analytics: 0 },
            },
          };
        }
        return { data: null };
      }
    },
    enabled: !!idOrCode,
    staleTime: 10 * 60_000,
  });
}

export function useCreateCountry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => tenantPost('/api/v1/settings/countries', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'countries'] }),
  });
}

export function useUpdateCountry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      tenantPut(`/api/v1/settings/countries/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'countries'] }),
  });
}

export function useDeleteCountry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tenantDelete(`/api/v1/settings/countries/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'countries'] }),
  });
}

export function useUpdateCountryStats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stats }: { id: string; stats: Record<string, number> }) =>
      tenantPatch(`/api/v1/settings/countries/${id}/stats`, { stats }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'countries'] }),
  });
}

export function useUpdateCountrySectors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sectorPerformance }: { id: string; sectorPerformance: Record<string, number> }) =>
      tenantPatch(`/api/v1/settings/countries/${id}/sectors`, { sectorPerformance }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'countries'] }),
  });
}

export function useAddCountryRec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ countryId, recId }: { countryId: string; recId: string }) =>
      tenantPost(`/api/v1/settings/countries/${countryId}/recs`, { recId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'countries'] }),
  });
}

export function useRemoveCountryRec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ countryId, recId }: { countryId: string; recId: string }) =>
      tenantDelete(`/api/v1/settings/countries/${countryId}/recs/${recId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'countries'] }),
  });
}

// ── System Config ──

export function useSettingsConfig(category?: string) {
  const path = category
    ? `/api/v1/settings/config/${category}`
    : '/api/v1/settings/config';

  return useQuery({
    queryKey: ['settings', 'config', category],
    queryFn: () => tenantFetch(path),
    staleTime: 10 * 60_000,
  });
}

export function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ category, key, value }: { category: string; key: string; value: unknown }) =>
      tenantPut(`/api/v1/settings/config/${category}/${key}`, { value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'config'] }),
  });
}

export function useBulkUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (configs: { category: string; key: string; value: unknown }[]) =>
      tenantPost('/api/v1/settings/config/bulk', { configs }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'config'] }),
  });
}

// ── Domains ──

export function useSettingsDomains() {
  return useQuery({
    queryKey: ['settings', 'domains'],
    queryFn: () => tenantFetch('/api/v1/settings/domains'),
    staleTime: 10 * 60_000,
  });
}

export function useUpdateDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      tenantPut(`/api/v1/settings/domains/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'domains'] }),
  });
}

// ── Scope ──

export function useSettingsScope() {
  return useQuery({
    queryKey: ['settings', 'scope'],
    queryFn: () => tenantFetch('/api/v1/settings/scope'),
    staleTime: 10 * 60_000,
  });
}

// ── Admin Levels ──

import { ADMIN_DIVISIONS } from '@/data/admin-divisions';
import { COUNTRIES } from '@/data/countries-config';

export interface AdminLevel {
  id?: string;
  level: number;
  name: Record<string, string>;
  code: string;
  isActive?: boolean;
}

/** Resolve ISO-alpha-2 country code from an id that could be UUID, ISO code, etc. */
function resolveCountryCode(idOrCode: string): string | undefined {
  // Direct match
  if (ADMIN_DIVISIONS[idOrCode]) return idOrCode;
  if (ADMIN_DIVISIONS[idOrCode.toUpperCase()]) return idOrCode.toUpperCase();
  // Match by tenantId or code in COUNTRIES config
  const allCountries = Object.values(COUNTRIES);
  const country = allCountries.find(
    (c) => c.code === idOrCode || c.code.toLowerCase() === idOrCode.toLowerCase()
      || c.tenantId === idOrCode,
  );
  return country?.code;
}

/** Build fallback admin levels from GADM data for a given country code */
function buildFallbackAdminLevels(countryCode: string): { data: AdminLevel[] } {
  const div = ADMIN_DIVISIONS[countryCode];
  if (!div) return { data: [] };

  const levels: AdminLevel[] = [];
  for (const [lvl, def] of Object.entries(div.levelTypes)) {
    levels.push({
      id: `gadm-${countryCode}-${lvl}`,
      level: parseInt(lvl, 10),
      name: { en: def.en, fr: def.fr, pt: def.pt, ar: def.en },
      code: def.en.toLowerCase().replace(/\s+/g, '-'),
      isActive: true,
    });
  }
  return { data: levels.sort((a, b) => a.level - b.level) };
}

/**
 * Fetch admin levels for a country.
 * @param countryId - URL param (UUID or ISO code)
 * @param countryCode - Optional resolved ISO-alpha-2 code (e.g., from useSettingsCountry)
 */
export function useAdminLevels(countryId: string, countryCode?: string) {
  return useQuery({
    queryKey: ['settings', 'admin-levels', countryId, countryCode],
    queryFn: async () => {
      let apiResult: { data: AdminLevel[] } | null = null;
      try {
        apiResult = await tenantFetch<{ data: AdminLevel[] }>(
          `/api/v1/settings/countries/${countryId}/admin-levels`,
        );
      } catch {
        // API failed — will use GADM data below
      }
      // If API returned non-empty data, use it
      if (apiResult?.data && apiResult.data.length > 0) return apiResult;
      // Resolve country code and use GADM pre-registered data
      const code = countryCode || resolveCountryCode(countryId);
      if (code) return buildFallbackAdminLevels(code);
      return { data: [] as AdminLevel[] };
    },
    enabled: !!countryId,
    staleTime: 10 * 60_000,
  });
}

export function useUpsertAdminLevels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ countryId, levels }: { countryId: string; levels: AdminLevel[] }) =>
      tenantPut(`/api/v1/settings/countries/${countryId}/admin-levels`, { levels }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['settings', 'admin-levels', vars.countryId] });
    },
  });
}

export function useDeleteAdminLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ countryId, level }: { countryId: string; level: number }) =>
      tenantDelete(`/api/v1/settings/countries/${countryId}/admin-levels/${level}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['settings', 'admin-levels', vars.countryId] });
    },
  });
}

// ── Functions (Job Titles / Roles) ──

export interface FunctionItem {
  id: string;
  code: string;
  name: Record<string, string>;
  description?: Record<string, string> | null;
  level: 'continental' | 'regional' | 'national';
  category?: string | null;
  permissions?: Record<string, unknown> | null;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
}

export function useSettingsFunctions(params?: { search?: string; level?: string; category?: string; status?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams();
  qs.set('page', String(params?.page ?? 1));
  qs.set('limit', String(params?.limit ?? 50));
  if (params?.search) qs.set('search', params.search);
  if (params?.level) qs.set('level', params.level);
  if (params?.category) qs.set('category', params.category);
  if (params?.status) qs.set('status', params.status);
  const query = `?${qs.toString()}`;

  return useQuery({
    queryKey: ['settings', 'functions', params],
    queryFn: () => tenantFetch<{ data: FunctionItem[]; meta: { total: number; page: number; limit: number } }>(`/api/v1/settings/functions${query}`),
    staleTime: 10 * 60_000,
  });
}

export function useSettingsFunction(id: string) {
  return useQuery({
    queryKey: ['settings', 'functions', id],
    queryFn: () => tenantFetch<{ data: FunctionItem }>(`/api/v1/settings/functions/${id}`),
    enabled: !!id,
    staleTime: 10 * 60_000,
  });
}

export function useCreateFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => tenantPost('/api/v1/settings/functions', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'functions'] }),
  });
}

export function useUpdateFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      tenantPut(`/api/v1/settings/functions/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'functions'] }),
  });
}

export function useDeleteFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tenantDelete(`/api/v1/settings/functions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'functions'] }),
  });
}

// ── Users Management ──

export interface ManagedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  locale: string;
  mfaEnabled: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  tenant?: {
    id: string;
    name: string;
    level: string;
    countryCode?: string | null;
    recCode?: string | null;
  };
  functions?: Array<{
    id: string;
    isPrimary: boolean;
    function: {
      id: string;
      code: string;
      name: Record<string, string>;
      level: string;
      category?: string | null;
    };
  }>;
}

export function useSettingsUsers(params?: {
  search?: string; role?: string; status?: string;
  tenantId?: string; functionId?: string;
  page?: number; limit?: number;
}) {
  const qs = new URLSearchParams();
  qs.set('page', String(params?.page ?? 1));
  qs.set('limit', String(params?.limit ?? 20));
  if (params?.search) qs.set('search', params.search);
  if (params?.role) qs.set('role', params.role);
  if (params?.status) qs.set('status', params.status);
  if (params?.tenantId) qs.set('tenantId', params.tenantId);
  if (params?.functionId) qs.set('functionId', params.functionId);
  const query = `?${qs.toString()}`;

  return useQuery({
    queryKey: ['settings', 'users', params],
    queryFn: () => tenantFetch<{ data: ManagedUser[]; meta: { total: number; page: number; limit: number } }>(`/api/v1/settings/users${query}`),
    staleTime: 2 * 60_000,
  });
}

export function useSettingsUser(id: string) {
  return useQuery({
    queryKey: ['settings', 'users', id],
    queryFn: () => tenantFetch<{ data: ManagedUser }>(`/api/v1/settings/users/${id}`),
    enabled: !!id,
    staleTime: 2 * 60_000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => tenantPost('/api/v1/settings/users', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      tenantPut(`/api/v1/settings/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'users'] }),
  });
}

export function useResetUserPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      tenantPatch(`/api/v1/settings/users/${id}/password`, { password }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tenantDelete(`/api/v1/settings/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'users'] }),
  });
}

// ── User-Function Assignment ──

export function useUserFunctions(userId: string) {
  return useQuery({
    queryKey: ['settings', 'user-functions', userId],
    queryFn: () => tenantFetch(`/api/v1/settings/users/${userId}/functions`),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

export function useAssignUserFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, functionId, isPrimary, notes }: {
      userId: string; functionId: string; isPrimary?: boolean; notes?: string;
    }) => tenantPost(`/api/v1/settings/users/${userId}/functions`, { functionId, isPrimary, notes }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['settings', 'user-functions', vars.userId] });
      qc.invalidateQueries({ queryKey: ['settings', 'users'] });
    },
  });
}

export function useRemoveUserFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, functionId }: { userId: string; functionId: string }) =>
      tenantDelete(`/api/v1/settings/users/${userId}/functions/${functionId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['settings', 'user-functions', vars.userId] });
      qc.invalidateQueries({ queryKey: ['settings', 'users'] });
    },
  });
}
