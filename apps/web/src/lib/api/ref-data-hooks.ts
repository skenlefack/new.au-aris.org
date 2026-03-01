'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from './client';

const MASTER_DATA_API = process.env['NEXT_PUBLIC_MASTER_DATA_API_URL'] ?? 'http://localhost:3003';

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
  const url = new URL(`${MASTER_DATA_API}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString(), { headers: getAuthHeaders() });
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
  const res = await fetch(`${MASTER_DATA_API}${path}`, {
    method: 'DELETE', headers: getAuthHeaders(),
  });
  return handleRes<T>(res);
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type RefDataType =
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
  | 'legal-framework-types' | 'stakeholder-types';

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
