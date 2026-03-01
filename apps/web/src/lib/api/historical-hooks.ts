'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from './client';

const HIST_API_BASE =
  process.env.NEXT_PUBLIC_DATALAKE_URL ?? 'http://localhost:3044/api/v1/historical';

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

async function histFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init?.headers || {}) },
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
