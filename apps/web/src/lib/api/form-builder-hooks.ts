'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from './client';

// Form-builder service has its own base URL (port 3010 in dev).
// With Traefik gateway: set NEXT_PUBLIC_FORM_BUILDER_URL=http://localhost:4000/api/v1/form-builder
const FB_API_BASE =
  process.env.NEXT_PUBLIC_FORM_BUILDER_URL ?? 'http://localhost:3010/api/v1/form-builder';

// ── lightweight fetch helper for form-builder service ──
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

async function fbFetch<T>(url: string, init?: RequestInit): Promise<T> {
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

const fb = {
  get: <T>(path: string, params?: Record<string, string>): Promise<T> => {
    const u = new URL(`${FB_API_BASE}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return fbFetch<T>(u.toString());
  },
  post: <T>(path: string, body?: unknown): Promise<T> =>
    fbFetch<T>(`${FB_API_BASE}${path}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    fbFetch<T>(`${FB_API_BASE}${path}`, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string): Promise<T> =>
    fbFetch<T>(`${FB_API_BASE}${path}`, { method: 'DELETE' }),
};

// ════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════

export interface FormTemplateListItem {
  id: string;
  tenantId: string;
  name: string;
  domain: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  dataClassification: string;
  createdBy: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  schema: unknown;
  uiSchema: unknown;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

interface ApiResponse<T> {
  data: T;
}

// ════════════════════════════════════════════════════════════════
// TEMPLATES
// ════════════════════════════════════════════════════════════════

// ---- List templates ----
export function useFormBuilderTemplates(params?: {
  page?: number;
  limit?: number;
  domain?: string;
  status?: string;
}) {
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams.page = String(params.page);
  if (params?.limit) queryParams.limit = String(params.limit);
  if (params?.domain) queryParams.domain = params.domain;
  if (params?.status) queryParams.status = params.status;

  return useQuery({
    queryKey: ['form-builder', 'templates', params],
    queryFn: () => fb.get<PaginatedResponse<FormTemplateListItem>>('/templates', queryParams),
    staleTime: 30_000,
    placeholderData: {
      data: [],
      meta: { total: 0, page: 1, limit: 20 },
    },
  });
}

// ---- Get single template ----
export function useFormBuilderTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['form-builder', 'template', id],
    queryFn: () => fb.get<ApiResponse<FormTemplateListItem>>(`/templates/${id}`),
    enabled: !!id,
    staleTime: 10_000,
  });
}

// ---- Create template ----
export function useCreateFormTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; domain: string; schema: unknown; uiSchema?: unknown }) =>
      fb.post<ApiResponse<FormTemplateListItem>>('/templates', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'templates'] });
    },
  });
}

// ---- Update template ----
export function useUpdateFormTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; domain?: string; schema?: unknown; uiSchema?: unknown }) =>
      fb.patch<ApiResponse<FormTemplateListItem>>(`/templates/${id}`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'templates'] });
      qc.invalidateQueries({ queryKey: ['form-builder', 'template', vars.id] });
    },
  });
}

// ---- Publish template ----
export function usePublishFormTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fb.post<ApiResponse<FormTemplateListItem>>(`/templates/${id}/publish`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'templates'] });
      qc.invalidateQueries({ queryKey: ['form-builder', 'template', id] });
    },
  });
}

// ---- Archive template ----
export function useArchiveFormTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fb.post<ApiResponse<FormTemplateListItem>>(`/templates/${id}/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'templates'] });
    },
  });
}

// ---- Duplicate template ----
export function useDuplicateFormTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fb.post<ApiResponse<FormTemplateListItem>>(`/templates/${id}/duplicate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'templates'] });
    },
  });
}

// ---- Import from Excel ----
export function useImportExcelTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, name, domain }: { file: File; name: string; domain: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      const params = new URLSearchParams({ name, domain });
      const headers = getAuthHeaders();
      // Remove Content-Type so the browser sets multipart/form-data with boundary
      delete headers['Content-Type'];

      const res = await fetch(`${FB_API_BASE}/templates/import-excel?${params}`, {
        method: 'POST',
        headers,
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Import failed');
      }
      return res.json() as Promise<ApiResponse<FormTemplateListItem>>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'templates'] });
    },
  });
}

// ---- Delete template ----
export function useDeleteFormTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fb.del<void>(`/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'templates'] });
    },
  });
}

// ════════════════════════════════════════════════════════════════
// SUBMISSIONS
// ════════════════════════════════════════════════════════════════

export interface FormSubmissionListItem {
  id: string;
  tenantId: string;
  templateId: string;
  data: Record<string, unknown>;
  status: 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'REJECTED';
  submittedBy: string;
  submittedAt: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  rejectionReason: string | null;
  geoLocation: unknown;
  createdAt: string;
  updatedAt: string;
}

// ---- List submissions for a template ----
export function useFormSubmissions(templateId: string | undefined, params?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams.page = String(params.page);
  if (params?.limit) queryParams.limit = String(params.limit);
  if (params?.status) queryParams.status = params.status;

  return useQuery({
    queryKey: ['form-builder', 'submissions', templateId, params],
    queryFn: () => fb.get<PaginatedResponse<FormSubmissionListItem>>(
      `/templates/${templateId}/submissions`,
      queryParams,
    ),
    enabled: !!templateId,
    staleTime: 10_000,
  });
}

// ---- Create submission ----
export function useCreateSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, ...body }: {
      templateId: string;
      data: Record<string, unknown>;
      status?: 'DRAFT' | 'SUBMITTED';
      geoLocation?: Record<string, unknown>;
    }) => fb.post<ApiResponse<FormSubmissionListItem>>(
      `/templates/${templateId}/submissions`,
      body,
    ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'submissions', vars.templateId] });
    },
  });
}

// ---- Update submission ----
export function useUpdateSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: {
      id: string;
      data?: Record<string, unknown>;
      status?: 'DRAFT' | 'SUBMITTED';
    }) => fb.patch<ApiResponse<FormSubmissionListItem>>(
      `/submissions/${id}`,
      body,
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'submissions'] });
    },
  });
}

// ---- Query field values for form-data-select ----
export function useFieldValues(templateId: string | undefined, fieldCode: string | undefined, search?: string) {
  const queryParams: Record<string, string> = {};
  if (search) queryParams.search = search;

  return useQuery({
    queryKey: ['form-builder', 'field-values', templateId, fieldCode, search],
    queryFn: () => fb.get<{ data: Array<{ value: unknown; label: string }> }>(
      `/templates/${templateId}/field-values/${fieldCode}`,
      queryParams,
    ),
    enabled: !!templateId && !!fieldCode,
    staleTime: 30_000,
  });
}
