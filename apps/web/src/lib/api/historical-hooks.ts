'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from './client';

export const HIST_API_BASE =
  process.env.NEXT_PUBLIC_DATALAKE_URL ?? '/api/v1/historical';

/* ------------------------------------------------------------------ */
/*  Auth helper                                                         */
/* ------------------------------------------------------------------ */

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window === 'undefined') return headers;
  try {
    const auth = JSON.parse(localStorage.getItem('aris-auth') || '{}');
    const token = auth?.state?.accessToken;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch { /* ignore */ }
  try {
    const t = JSON.parse(localStorage.getItem('aris-tenant') || '{}');
    const tid = t?.state?.selectedTenantId;
    if (tid) headers['X-Tenant-Id'] = tid;
  } catch { /* ignore */ }
  return headers;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const auth = JSON.parse(localStorage.getItem('aris-auth') || '{}');
    return auth?.state?.accessToken ?? null;
  } catch { return null; }
}

export async function histFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const base: Record<string, string> = { ...getAuthHeaders(), ...((init?.headers ?? {}) as Record<string, string>) };
  if ((init?.method ?? 'GET').toUpperCase() === 'DELETE') delete base['Content-Type'];
  const res = await fetch(url, {
    ...init,
    headers: base,
  });
  if (!res.ok) {
    let body: { message?: string } | undefined;
    try { body = await res.json(); } catch { /* non-json */ }
    throw new ApiClientError(res.status, body?.message ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface HistoricalDataset {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  domain: string;
  sourceFile: string;
  fileType: string;
  fileSizeBytes: number;
  originalFileName: string;
  tableName: string;
  rowCount: number;
  columnCount: number;
  status: 'PENDING' | 'ANALYZING' | 'IMPORTING' | 'READY' | 'FAILED' | 'ARCHIVED';
  errorMessage: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  createdBy: string;
  created_at: string;
  updated_at: string;
  columns?: DatasetColumn[];
  analyses?: DatasetAnalysis[];
}

export interface DatasetColumn {
  id: string;
  datasetId: string;
  name: string;
  originalName: string;
  dataType: string;
  pgColumnName: string;
  nullable: boolean;
  ordinal: number;
  sampleValues: unknown[];
  stats: {
    nullCount: number;
    uniqueCount: number;
    min?: unknown;
    max?: unknown;
  } | null;
  linkedRefType: string | null;
  linkedRefField: string | null;
}

export interface DatasetAnalysis {
  id: string;
  datasetId: string;
  type: string;
  title: string;
  description: string | null;
  config: Record<string, unknown>;
  result: Record<string, unknown> | null;
  createdBy: string;
  created_at: string;
}

export interface AnalysisResult {
  columns: Array<{
    name: string;
    originalName: string;
    dataType: string;
    pgColumnName: string;
    nullable: boolean;
    ordinal: number;
    sampleValues: unknown[];
    stats: {
      nullCount: number;
      uniqueCount: number;
      min?: unknown;
      max?: unknown;
    };
  }>;
  rowCount: number;
  preview: Record<string, unknown>[];
  fileType: string;
}

export interface HistoricalStats {
  totalDatasets: number;
  totalRows: number;
  byStatus: Array<{ status: string; count: number }>;
  byDomain: Array<{ domain: string; count: number }>;
}

/* ------------------------------------------------------------------ */
/*  Query hooks                                                         */
/* ------------------------------------------------------------------ */

export function useHistoricalDatasets(params?: {
  page?: number;
  limit?: number;
  domain?: string;
  status?: string;
  search?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.domain) qs.set('domain', params.domain);
  if (params?.status) qs.set('status', params.status);
  if (params?.search) qs.set('search', params.search);
  const suffix = qs.toString() ? `?${qs}` : '';

  return useQuery<{ data: HistoricalDataset[]; meta: { total: number; page: number; limit: number } }>({
    queryKey: ['historical-datasets', params],
    queryFn: () => histFetch(`${HIST_API_BASE}${suffix}`),
  });
}

export function useHistoricalDataset(id: string | undefined) {
  return useQuery<{ data: HistoricalDataset }>({
    queryKey: ['historical-dataset', id],
    queryFn: () => histFetch(`${HIST_API_BASE}/${id}`),
    enabled: !!id,
  });
}

export function useHistoricalStats() {
  return useQuery<{ data: HistoricalStats }>({
    queryKey: ['historical-stats'],
    queryFn: () => histFetch(`${HIST_API_BASE}/stats`),
  });
}

export function useDatasetData(datasetId: string | undefined, params?: {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.sort) qs.set('sort', params.sort);
  if (params?.order) qs.set('order', params.order);
  if (params?.search) qs.set('search', params.search);
  const suffix = qs.toString() ? `?${qs}` : '';

  return useQuery<{ data: Record<string, unknown>[]; meta: { total: number; page: number; limit: number } }>({
    queryKey: ['dataset-data', datasetId, params],
    queryFn: () => histFetch(`${HIST_API_BASE}/${datasetId}/data${suffix}`),
    enabled: !!datasetId,
  });
}

export function useDatasetAnalyses(datasetId: string | undefined) {
  return useQuery<{ data: DatasetAnalysis[] }>({
    queryKey: ['dataset-analyses', datasetId],
    queryFn: () => histFetch(`${HIST_API_BASE}/${datasetId}/analyses`),
    enabled: !!datasetId,
  });
}

/* ------------------------------------------------------------------ */
/*  Mutation hooks                                                      */
/* ------------------------------------------------------------------ */

export function useAnalyzeFile() {
  return useMutation<{ data: AnalysisResult }, Error, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${HIST_API_BASE}/analyze`, {
        method: 'POST',
        headers,
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiClientError(res.status, body?.message ?? 'Analysis failed');
      }
      return res.json();
    },
  });
}

export function useImportDataset() {
  const queryClient = useQueryClient();

  return useMutation<{ data: HistoricalDataset }, Error, {
    file: File;
    name: string;
    domain: string;
    description?: string;
    tags?: string[];
  }>({
    mutationFn: async ({ file, name, domain, description, tags }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      formData.append('domain', domain);
      if (description) formData.append('description', description);
      if (tags) formData.append('tags', JSON.stringify(tags));

      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${HIST_API_BASE}/import`, {
        method: 'POST',
        headers,
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiClientError(res.status, body?.message ?? 'Import failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historical-datasets'] });
      queryClient.invalidateQueries({ queryKey: ['historical-stats'] });
    },
  });
}

export function useUpdateDataset() {
  const queryClient = useQueryClient();

  return useMutation<{ data: HistoricalDataset }, Error, {
    id: string;
    data: { name?: string; description?: string; domain?: string; tags?: string[] };
  }>({
    mutationFn: ({ id, data }) =>
      histFetch(`${HIST_API_BASE}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['historical-datasets'] });
      queryClient.invalidateQueries({ queryKey: ['historical-dataset', vars.id] });
    },
  });
}

export function useDeleteDataset() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      histFetch(`${HIST_API_BASE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historical-datasets'] });
      queryClient.invalidateQueries({ queryKey: ['historical-stats'] });
    },
  });
}

export function useUpdateDatasetRow() {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, {
    datasetId: string;
    rowId: number;
    data: Record<string, unknown>;
  }>({
    mutationFn: ({ datasetId, rowId, data }) =>
      histFetch(`${HIST_API_BASE}/${datasetId}/data/${rowId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['dataset-data', vars.datasetId] });
    },
  });
}

export function useAggregateData() {
  return useMutation<{ data: unknown[] }, Error, {
    datasetId: string;
    column: string;
    operation: string;
    groupBy?: string;
  }>({
    mutationFn: ({ datasetId, ...body }) =>
      histFetch(`${HIST_API_BASE}/${datasetId}/aggregate`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

export function useTimeSeriesData() {
  return useMutation<{ data: unknown[] }, Error, {
    datasetId: string;
    dateColumn: string;
    valueColumn: string;
    interval: string;
    operation?: string;
  }>({
    mutationFn: ({ datasetId, ...body }) =>
      histFetch(`${HIST_API_BASE}/${datasetId}/time-series`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

export function useCreateAnalysis() {
  const queryClient = useQueryClient();

  return useMutation<{ data: DatasetAnalysis }, Error, {
    datasetId: string;
    type: string;
    title: string;
    description?: string;
    config: Record<string, unknown>;
  }>({
    mutationFn: ({ datasetId, ...body }) =>
      histFetch(`${HIST_API_BASE}/${datasetId}/analyses`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['dataset-analyses', vars.datasetId] });
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Cross-dataset analytics hooks (dashboard)                           */
/* ------------------------------------------------------------------ */

export interface DashboardKpis {
  year: number;
  totalReports: number;
  totalOutbreaks: number;
  uniqueDiseases: number;
  uniqueLocations: number;
  pctChangeReports: number;
  pctChangeOutbreaks: number;
  pctChangeDiseases: number;
  pctChangeLocations: number;
  yearlyBreakdown: Array<{
    yr: number;
    outbreak_rows: number;
    unique_diseases: number;
    unique_locations: number;
    total_outbreaks: number;
  }>;
}

export interface CrossTimeSeriesParams {
  datasetIds: string[];
  dateColumn: string;
  valueColumn: string;
  interval: 'day' | 'week' | 'month' | 'year';
  operation?: 'count' | 'sum' | 'avg';
  groupBy?: string;
  filters?: Record<string, string>;
}

export interface CrossAggregateParams {
  datasetIds: string[];
  column: string;
  operation: 'count' | 'sum' | 'avg' | 'distribution';
  groupBy?: string;
  filters?: Record<string, string>;
}

export function useCrossTimeSeries() {
  return useMutation<{ data: unknown[] }, Error, CrossTimeSeriesParams>({
    mutationFn: (body) =>
      histFetch(`${HIST_API_BASE}/cross-query`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

export function useCrossAggregate() {
  return useMutation<{ data: unknown[] }, Error, CrossAggregateParams>({
    mutationFn: (body) =>
      histFetch(`${HIST_API_BASE}/cross-aggregate`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

export function useDashboardKpis(params?: {
  year?: number;
  datasetIds?: string[];
}) {
  const qs = new URLSearchParams();
  if (params?.year) qs.set('year', String(params.year));
  if (params?.datasetIds?.length) qs.set('datasetIds', params.datasetIds.join(','));
  const suffix = qs.toString() ? `?${qs}` : '';

  return useQuery<{ data: DashboardKpis }>({
    queryKey: ['historical-dashboard-kpis', params],
    queryFn: () => histFetch(`${HIST_API_BASE}/dashboard-kpis${suffix}`),
    enabled: true,
  });
}

/* ------------------------------------------------------------------ */
/*  Pivot + Export hooks                                                */
/* ------------------------------------------------------------------ */

export interface PivotResult {
  rows: string[];
  columns: string[];
  matrix: Record<string, Record<string, number>>;
}

export function usePivotData() {
  return useMutation<{ data: PivotResult }, Error, {
    datasetId: string;
    rowField: string;
    colField: string;
    valueField: string;
    operation?: 'count' | 'sum' | 'avg';
  }>({
    mutationFn: ({ datasetId, ...body }) =>
      histFetch(`${HIST_API_BASE}/${datasetId}/pivot`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

export function useExportCsvUrl(datasetId: string | undefined, search?: string): string {
  if (!datasetId) return '';
  const qs = new URLSearchParams();
  if (search) qs.set('search', search);
  const suffix = qs.toString() ? `?${qs}` : '';
  return `${HIST_API_BASE}/${datasetId}/export${suffix}`;
}

export function useDeleteAnalysis() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { datasetId: string; analysisId: string }>({
    mutationFn: ({ datasetId, analysisId }) =>
      histFetch(`${HIST_API_BASE}/${datasetId}/analyses/${analysisId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['dataset-analyses', vars.datasetId] });
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Disease UUID → Name resolver                                        */
/* ------------------------------------------------------------------ */

const DISEASE_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MASTER_DATA_API =
  process.env['NEXT_PUBLIC_MASTER_DATA_API_URL'] ?? '';

/**
 * Fetches all diseases from master-data ref API and builds a UUID→name map.
 * Cached for 10 minutes via react-query.
 */
export function useDiseaseNameMap() {
  return useQuery<Record<string, string>>({
    queryKey: ['disease-name-map'],
    queryFn: async () => {
      const map: Record<string, string> = {};
      try {
        const res = await fetch(`${MASTER_DATA_API}/api/v1/master-data/ref/diseases?limit=500`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) return map;
        const body = await res.json();
        const items = body?.data ?? [];
        // Detect locale from localStorage or default to 'en'
        let locale = 'en';
        try {
          const stored = localStorage.getItem('aris-locale');
          if (stored) locale = JSON.parse(stored)?.state?.locale ?? 'en';
        } catch { /* ignore */ }
        for (const item of items) {
          if (item.id && item.name) {
            const name = typeof item.name === 'string'
              ? item.name
              : item.name[locale] ?? item.name['en'] ?? item.code ?? item.id;
            map[item.id] = name;
          }
        }
      } catch { /* fallback: empty map, UUIDs will show as-is */ }
      return map;
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Resolves a disease value: if it's a UUID, returns the name from the map.
 * Otherwise returns the original value as-is.
 */
export function resolveDiseaseLabel(
  value: string | null | undefined,
  diseaseMap: Record<string, string> | undefined,
): string {
  if (!value) return '';
  if (!diseaseMap) return value;
  if (DISEASE_UUID_REGEX.test(value)) {
    return diseaseMap[value] ?? value;
  }
  return value;
}
