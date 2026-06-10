'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from './client';

const MASTER_DATA_API = process.env['NEXT_PUBLIC_MASTER_DATA_API_URL'] ?? '';

// ─── Auth helpers (same pattern as settings-hooks) ─────────────────────────

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

async function handleRes<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: any;
    try { body = await res.json(); } catch { /* non-json */ }
    throw new ApiClientError(res.status, body?.message ?? `Request failed: ${res.status}`, body?.errors);
  }
  return res.json();
}

async function mdGet<T = any>(path: string, params?: Record<string, string>): Promise<T> {
  let url = `${MASTER_DATA_API}${path}`;
  if (params) {
    const filtered = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (filtered.length > 0) {
      url += `?${new URLSearchParams(filtered).toString()}`;
    }
  }
  const res = await fetch(url, { headers: getAuthHeaders() });
  return handleRes<T>(res);
}

async function mdPost<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${MASTER_DATA_API}${path}`, {
    method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
  });
  return handleRes<T>(res);
}

async function mdPut<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${MASTER_DATA_API}${path}`, {
    method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(body),
  });
  return handleRes<T>(res);
}

async function mdDelete<T = any>(path: string): Promise<T> {
  const { 'Content-Type': _, ...headers } = getAuthHeaders();
  const res = await fetch(`${MASTER_DATA_API}${path}`, {
    method: 'DELETE', headers,
  });
  return handleRes<T>(res);
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type RefDataType =
  // Non-ref tables (dedicated /for-select routes)
  | 'countries' | 'geo-entities' | 'units'
  // Ref tables — Core
  | 'species-groups' | 'species' | 'age-groups' | 'diseases'
  | 'clinical-signs' | 'control-measures' | 'seizure-reasons'
  | 'sample-types' | 'contamination-sources' | 'abattoirs'
  | 'markets' | 'checkpoints' | 'production-systems'
  // Phase 2 — 20 new types
  | 'breeds' | 'vaccine-types' | 'test-types' | 'labs'
  | 'livestock-products' | 'census-methodologies'
  | 'gear-types' | 'vessel-types' | 'aquaculture-farm-types' | 'landing-sites'
  | 'conservation-statuses' | 'habitat-types' | 'crime-types'
  | 'commodities'
  | 'hive-types' | 'bee-diseases' | 'floral-sources'
  | 'legal-framework-types' | 'stakeholder-types'
  // Phase 3 — Infrastructures & Institutions
  | 'infrastructures'
  // Phase 4 — WOAH/References-data enrichment (13 new types)
  | 'diagnosis-bases' | 'body-parts' | 'causal-agent-types'
  | 'outbreak-statuses' | 'epidemiological-unit-types' | 'notification-reasons'
  | 'source-of-infections' | 'transport-modes' | 'animal-sexes'
  | 'animal-husbandries' | 'genetic-diversities' | 'data-sources'
  | 'fish-families';

export interface MultilingualValue {
  en?: string;
  fr?: string;
  pt?: string;
  ar?: string;
  es?: string;
  [key: string]: string | undefined;
}

export interface RefDataItem {
  id: string;
  code: string;
  name: MultilingualValue;
  description?: MultilingualValue;
  scope: string;
  ownerId?: string | null;
  ownerType: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  metadata?: any;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  // Type-specific fields
  icon?: string;
  scientificName?: string;
  groupId?: string;
  group?: RefDataItem;
  speciesId?: string;
  species?: RefDataItem;
  minMonths?: number | null;
  maxMonths?: number | null;
  oieCode?: string;
  isNotifiable?: boolean;
  isZoonotic?: boolean;
  category?: string;
  diseaseId?: string;
  disease?: RefDataItem;
  severity?: string;
  type?: string;
  storageTemp?: string;
  capacity?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  adminLevel1?: string;
  adminLevel2?: string;
  adminLevel3?: string;
  contactName?: string;
  contactPhone?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  frequency?: string;
  marketDay?: string;
  borderWith?: string;
  operatingHours?: string;
  susceptibility?: string;
  diseaseSpecies?: Array<{ id: string; speciesId: string; diseaseId: string; susceptibility?: string; species?: RefDataItem }>;
  ageGroups?: RefDataItem[];
  // Phase 2 fields
  origin?: string;
  purpose?: string;
  vaccineClass?: string;
  manufacturer?: string;
  routeOfAdmin?: string;
  dosesRequired?: number;
  testCategory?: string;
  turnaroundDays?: number;
  labLevel?: string;
  bslLevel?: number;
  accreditation?: string;
  productCategory?: string;
  methodType?: string;
  gearCategory?: string;
  lengthCategory?: string;
  propulsionType?: string;
  waterType?: string;
  cultureSystem?: string;
  iucnCode?: string;
  biome?: string;
  crimeCategory?: string;
  hsCode?: string;
  commodityGroup?: string;
  hiveCategory?: string;
  pathogenType?: string;
  affectedCaste?: string;
  floweringSeason?: string;
  nectarType?: string;
  frameworkCategory?: string;
  sector?: string;
  // Phase 3 — Infrastructure fields
  subType?: string;
  year?: number;
  yearEstablished?: number;
  countryCode?: string;
  adminLevel4?: string;
  adminLevel5?: string;
  locationName?: string;
  abbreviation?: string;
  quantity?: number;
  contactPerson?: string;
  email?: string;
  telephone?: string;
  status?: string;
  comment?: string;
}

export interface SelectOption {
  id: string;
  code: string;
  name: MultilingualValue;
}

export interface RefDataListParams {
  page?: number;
  limit?: number;
  search?: string;
  scope?: string;
  isActive?: string;
  groupId?: string;
  speciesId?: string;
  diseaseId?: string;
  adminLevel1?: string;
  type?: string;
  category?: string;
  subType?: string;
  countryCode?: string;
  status?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

// ─── Dashboard counts ──────────────────────────────────────────────────────

export function useRefDataCounts() {
  return useQuery({
    queryKey: ['ref-data', 'counts'],
    queryFn: () => mdGet<{ data: Record<string, number> }>('/api/v1/master-data/ref/counts'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── List ──────────────────────────────────────────────────────────────────

export function useRefDataList(type: RefDataType, params: RefDataListParams = {}) {
  const queryParams: Record<string, string> = {};
  if (params.page) queryParams['page'] = String(params.page);
  if (params.limit) queryParams['limit'] = String(params.limit);
  if (params.search) queryParams['search'] = params.search;
  if (params.scope) queryParams['scope'] = params.scope;
  if (params.isActive) queryParams['isActive'] = params.isActive;
  if (params.groupId) queryParams['groupId'] = params.groupId;
  if (params.speciesId) queryParams['speciesId'] = params.speciesId;
  if (params.diseaseId) queryParams['diseaseId'] = params.diseaseId;
  if (params.adminLevel1) queryParams['adminLevel1'] = params.adminLevel1;
  if (params.type) queryParams['type'] = params.type;
  if (params.category) queryParams['category'] = params.category;
  if (params.subType) queryParams['subType'] = params.subType;
  if (params.countryCode) queryParams['countryCode'] = params.countryCode;
  if (params.status) queryParams['status'] = params.status;

  return useQuery({
    queryKey: ['ref-data', type, params],
    queryFn: () => mdGet<PaginatedResponse<RefDataItem>>(`/api/v1/master-data/ref/${type}`, queryParams),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── For-select (optimized dropdown) ───────────────────────────────────────

export function useRefDataForSelect(
  type: RefDataType,
  parentFilter?: Record<string, string>,
  enabled = true,
) {
  const queryParams: Record<string, string> = {};
  if (parentFilter) {
    Object.entries(parentFilter).forEach(([k, v]) => {
      if (v) queryParams[k] = v;
    });
  }

  return useQuery({
    queryKey: ['ref-data', type, 'for-select', parentFilter],
    queryFn: () => mdGet<{ data: SelectOption[] }>(`/api/v1/master-data/ref/${type}/for-select`, queryParams),
    staleTime: 5 * 60 * 1000,
    enabled,
    retry: 1,
  });
}

// ─── Single item ───────────────────────────────────────────────────────────

export function useRefDataItem(type: RefDataType, id: string | undefined) {
  return useQuery({
    queryKey: ['ref-data', type, id],
    queryFn: () => mdGet<{ data: RefDataItem }>(`/api/v1/master-data/ref/${type}/${id}`),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

// ─── Create ────────────────────────────────────────────────────────────────

export function useCreateRefData(type: RefDataType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, any>) => mdPost<{ data: RefDataItem }>(`/api/v1/master-data/ref/${type}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ref-data', type] });
      qc.invalidateQueries({ queryKey: ['ref-data', 'counts'] });
    },
  });
}

// ─── Update ────────────────────────────────────────────────────────────────

export function useUpdateRefData(type: RefDataType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, any> }) =>
      mdPut<{ data: RefDataItem }>(`/api/v1/master-data/ref/${type}/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ref-data', type] });
      qc.invalidateQueries({ queryKey: ['ref-data', 'counts'] });
    },
  });
}

// ─── Delete (soft) ─────────────────────────────────────────────────────────

export function useDeleteRefData(type: RefDataType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mdDelete<{ data: RefDataItem }>(`/api/v1/master-data/ref/${type}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ref-data', type] });
      qc.invalidateQueries({ queryKey: ['ref-data', 'counts'] });
    },
  });
}

// ─── PAID v2 Referentials (hierarchical tables in animal_health schema) ──

export type PaidRefCategory =
  | 'PAID_PROJECT' | 'PAID_LOGFRAME' | 'PAID_LF_ACTIVITY'
  | 'PAID_SUBACTIVITY' | 'PAID_PAID_ACTIVITY' | 'PAID_BREAKDOWN_FIELD'
  | 'PAID_EXEC_PARTNER' | 'PAID_IMPL_PARTNER_INTL' | 'PAID_IMPL_PARTNER_NATIONAL';

export interface PaidReferentialItem {
  id: number;
  code: string;
  label?: string;
  title?: string;
  name?: string;
  type?: string;
  countries?: string[];
  project_code?: string;
  logframe_code?: string;
  activity_code?: string;
  subactivity_code?: string;
  paid_activity_code?: string;
  country_code?: string;
  unit_of_measure?: string;
  field_code?: string;
  field_label?: string;
  field_type?: string;
  field_options?: unknown;
  sort_order?: number;
  is_required?: boolean;
}

/** Map PAID category to API endpoint path */
const PAID_ENDPOINT: Record<string, string> = {
  PAID_PROJECT: '/api/v1/master-data/paid/projects',
  PAID_LOGFRAME: '/api/v1/master-data/paid/logframes',
  PAID_LF_ACTIVITY: '/api/v1/master-data/paid/lf-activities',
  PAID_SUBACTIVITY: '/api/v1/master-data/paid/subactivities',
  PAID_PAID_ACTIVITY: '/api/v1/master-data/paid/paid-activities',
  PAID_BREAKDOWN_FIELD: '/api/v1/master-data/paid/breakdown-fields',
  PAID_EXEC_PARTNER: '/api/v1/master-data/paid/executive-partners',
  PAID_IMPL_PARTNER_INTL: '/api/v1/master-data/paid/impl-partners-intl',
  PAID_IMPL_PARTNER_NATIONAL: '/api/v1/master-data/paid/impl-partners-national',
};

/**
 * Fetch PAID referentials by category with cascade filters.
 * Cascade: project → logframe → activity → subactivity → paid_activity
 */
export function usePaidReferentials(
  category: PaidRefCategory,
  filters?: Record<string, string | undefined>,
) {
  const endpoint = PAID_ENDPOINT[category];
  const params: Record<string, string> = { limit: '500' };
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      if (v) params[k] = v;
    }
  }

  return useQuery({
    queryKey: ['paid-ref', category, params],
    queryFn: () => mdGet<{ data: PaidReferentialItem[]; meta: { total: number } }>(endpoint, params),
    staleTime: 10 * 60_000,
    enabled: !!endpoint,
  });
}

// ─── PAID CRUD mutations ──

export function useCreatePaidRef(category: PaidRefCategory) {
  const qc = useQueryClient();
  const endpoint = PAID_ENDPOINT[category];
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => mdPost(endpoint, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paid-ref', category] }),
  });
}

export function useUpdatePaidRef(category: PaidRefCategory) {
  const qc = useQueryClient();
  const endpoint = PAID_ENDPOINT[category];
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      mdPut(`${endpoint}/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paid-ref', category] }),
  });
}

export function useDeletePaidRef(category: PaidRefCategory) {
  const qc = useQueryClient();
  const endpoint = PAID_ENDPOINT[category];
  return useMutation({
    mutationFn: (id: number) => mdDelete(`${endpoint}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paid-ref', category] }),
  });
}
