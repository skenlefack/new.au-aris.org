'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from './client';

// Form-builder service: proxied via Next.js rewrites in dev (no CORS).
// In production: Traefik routes /api/v1/form-builder/* to the form-builder service.
const FB_API_BASE =
  process.env.NEXT_PUBLIC_FORM_BUILDER_URL ?? '/api/v1/form-builder';

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

const fb = {
  get: <T>(path: string, params?: Record<string, string>): Promise<T> => {
    let url = `${FB_API_BASE}${path}`;
    if (params && Object.keys(params).length > 0) {
      url += `?${new URLSearchParams(params).toString()}`;
    }
    return fbFetch<T>(url);
  },
  post: <T>(path: string, body?: unknown): Promise<T> =>
    fbFetch<T>(`${FB_API_BASE}${path}`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown): Promise<T> =>
    fbFetch<T>(`${FB_API_BASE}${path}`, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    fbFetch<T>(`${FB_API_BASE}${path}`, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string): Promise<T> =>
    fbFetch<T>(`${FB_API_BASE}${path}`, { method: 'DELETE' }),
};

// ════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════

export type FormType = 'CAMPAIGN' | 'EVENT_ALERT' | 'PAID';

export interface FormTemplateListItem {
  id: string;
  tenantId: string;
  name: string;
  domain: string;
  formType?: FormType;
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
  search?: string;
  domain?: string;
  formType?: FormType;
  status?: string;
}) {
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams.page = String(params.page);
  if (params?.limit) queryParams.limit = String(params.limit);
  if (params?.search) queryParams.search = params.search;
  if (params?.domain) queryParams.domain = params.domain;
  if (params?.formType) queryParams.formType = params.formType;
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
    mutationFn: (body: { name: string; domain: string; formType?: FormType; schema: unknown; uiSchema?: unknown; targets?: Array<{ domainCode: string; subDomainCode: string | null; isPrimary: boolean }> }) =>
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
    mutationFn: ({ id, ...body }: { id: string; name?: string; domain?: string; schema?: unknown; uiSchema?: unknown; targets?: Array<{ domainCode: string; subDomainCode: string | null; isPrimary: boolean }> }) =>
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

// ---- List submissions from MULTIPLE templates (merged) ----
export function useMultiTemplateSubmissions(
  templateIds: string[],
  params?: { limit?: number; status?: string },
) {
  const queryParams: Record<string, string> = {};
  if (params?.limit) queryParams.limit = String(params.limit);
  if (params?.status) queryParams.status = params.status;

  return useQuery({
    queryKey: ['form-builder', 'multi-submissions', templateIds, params],
    queryFn: async () => {
      const results = await Promise.all(
        templateIds.map((tid) =>
          fb.get<PaginatedResponse<FormSubmissionListItem>>(
            `/templates/${tid}/submissions`,
            { ...queryParams, limit: String(params?.limit ?? 50) },
          ).catch(() => ({ data: [], meta: { total: 0, page: 1, limit: 50 } }) as PaginatedResponse<FormSubmissionListItem>),
        ),
      );
      const allData = results.flatMap((r) => r.data);
      allData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const total = results.reduce((s, r) => s + r.meta.total, 0);
      return { data: allData, meta: { total, page: 1, limit: allData.length } };
    },
    enabled: templateIds.length > 0,
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
      campaignId?: string;
      extensionId?: string;
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

// ════════════════════════════════════════════════════════════════
// OVERLAYS (Form Customization)
// ════════════════════════════════════════════════════════════════

export interface FieldOverride {
  fieldId: string;
  action: 'ADD' | 'MODIFY' | 'REMOVE' | 'REORDER';
  data: Record<string, unknown>;
}

export interface SectionOverride {
  sectionId: string;
  action: 'ADD' | 'MODIFY' | 'REMOVE' | 'REORDER';
  data: Record<string, unknown>;
}

export interface FormOverlayEntity {
  id: string;
  templateId: string;
  templateVersion: number;
  tenantId: string;
  tenantLevel: string;
  parentOverlayId: string | null;
  fieldOverrides: FieldOverride[];
  sectionOverrides: SectionOverride[] | null;
  metadataOverrides: unknown | null;
  isActive: boolean;
  needsReview: boolean;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedForm {
  template: FormTemplateListItem;
  appliedOverlays: FormOverlayEntity[];
  resolvedFields: unknown[];
  resolvedSections: unknown[];
  inheritance: {
    level: string;
    chain: string[];
  };
}

// ---- List overlays for a template ----
export function useFormOverlays(
  templateId: string | undefined,
  params?: { page?: number; limit?: number; tenantLevel?: string },
) {
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams.page = String(params.page);
  if (params?.limit) queryParams.limit = String(params.limit);
  if (params?.tenantLevel) queryParams.tenantLevel = params.tenantLevel;

  return useQuery({
    queryKey: ['form-builder', 'overlays', templateId, params],
    queryFn: () =>
      fb.get<PaginatedResponse<FormOverlayEntity>>(
        `/templates/${templateId}/overlays`,
        queryParams,
      ),
    enabled: !!templateId,
    staleTime: 10_000,
  });
}

// ---- Get single overlay ----
export function useFormOverlay(
  templateId: string | undefined,
  overlayId: string | undefined,
) {
  return useQuery({
    queryKey: ['form-builder', 'overlay', templateId, overlayId],
    queryFn: () =>
      fb.get<ApiResponse<FormOverlayEntity>>(
        `/templates/${templateId}/overlays/${overlayId}`,
      ),
    enabled: !!templateId && !!overlayId,
    staleTime: 10_000,
  });
}

// ---- Resolve merged form ----
export function useResolvedForm(
  templateId: string | undefined,
  tenantId: string | undefined,
) {
  return useQuery({
    queryKey: ['form-builder', 'resolved', templateId, tenantId],
    queryFn: () =>
      fb.get<{ data: ResolvedForm }>(
        `/templates/${templateId}/resolve`,
        { tenantId: tenantId! },
      ),
    enabled: !!templateId && !!tenantId,
    staleTime: 10_000,
  });
}

// ---- Create overlay ----
export function useCreateOverlay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      ...body
    }: {
      templateId: string;
      tenantId: string;
      tenantLevel: string;
      fieldOverrides: FieldOverride[];
      sectionOverrides?: SectionOverride[];
      metadataOverrides?: Record<string, unknown>;
    }) =>
      fb.post<ApiResponse<FormOverlayEntity>>(
        `/templates/${templateId}/overlays`,
        body,
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'overlays', vars.templateId] });
      qc.invalidateQueries({ queryKey: ['form-builder', 'resolved', vars.templateId] });
    },
  });
}

// ---- Update overlay ----
export function useUpdateOverlay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      overlayId,
      ...body
    }: {
      templateId: string;
      overlayId: string;
      fieldOverrides?: FieldOverride[];
      sectionOverrides?: SectionOverride[];
      metadataOverrides?: Record<string, unknown>;
    }) =>
      fb.put<ApiResponse<FormOverlayEntity>>(
        `/templates/${templateId}/overlays/${overlayId}`,
        body,
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'overlays', vars.templateId] });
      qc.invalidateQueries({ queryKey: ['form-builder', 'overlay', vars.templateId, vars.overlayId] });
      qc.invalidateQueries({ queryKey: ['form-builder', 'resolved', vars.templateId] });
    },
  });
}

// ---- Delete overlay ----
export function useDeleteOverlay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      overlayId,
    }: {
      templateId: string;
      overlayId: string;
    }) =>
      fb.del<void>(`/templates/${templateId}/overlays/${overlayId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'overlays', vars.templateId] });
      qc.invalidateQueries({ queryKey: ['form-builder', 'resolved', vars.templateId] });
    },
  });
}

// ════════════════════════════════════════════════════════════════
// REVIEWS & COMMENTS
// ════════════════════════════════════════════════════════════════

export interface ReviewEntity {
  id: string;
  templateId: string;
  tenantId: string;
  senderId: string;
  senderName: string;
  message: string | null;
  status: 'PENDING' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED';
  synthesis: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  commentCount: number;
  reviewers: Array<{
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    tenantId: string;
    hasRead: boolean;
    readAt: string | null;
  }>;
  template?: { id: string; name: string; domain: string; status: string } | null;
}

export interface ReviewCommentEntity {
  id: string;
  reviewId: string;
  userId: string;
  userName: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewWithComments extends ReviewEntity {
  comments: ReviewCommentEntity[];
}

// ---- Create review ----
export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      templateId: string;
      message?: string;
      reviewers: Array<{ userId: string; userName: string; userEmail: string; tenantId: string }>;
    }) => fb.post<{ data: ReviewEntity }>('/reviews', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'reviews'] });
    },
  });
}

// ---- List my reviews ----
export function useMyReviews(params?: { page?: number; limit?: number; status?: string }) {
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams.page = String(params.page);
  if (params?.limit) queryParams.limit = String(params.limit);
  if (params?.status) queryParams.status = params.status;

  return useQuery({
    queryKey: ['form-builder', 'reviews', 'mine', params],
    queryFn: () => fb.get<PaginatedResponse<ReviewEntity>>('/reviews', queryParams),
    staleTime: 15_000,
  });
}

// ---- Reviews for a template ----
export function useTemplateReviews(templateId: string | undefined) {
  return useQuery({
    queryKey: ['form-builder', 'reviews', 'template', templateId],
    queryFn: () => fb.get<{ data: ReviewEntity[] }>(`/reviews/template/${templateId}`),
    enabled: !!templateId,
    staleTime: 15_000,
  });
}

// ---- Get single review with comments ----
export function useReview(id: string | undefined) {
  return useQuery({
    queryKey: ['form-builder', 'review', id],
    queryFn: () => fb.get<{ data: ReviewWithComments }>(`/reviews/${id}`),
    enabled: !!id,
    staleTime: 10_000,
  });
}

// ---- Add comment ----
export function useAddReviewComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, ...body }: { reviewId: string; content: string; parentId?: string }) =>
      fb.post<{ data: ReviewCommentEntity }>(`/reviews/${reviewId}/comments`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'review', vars.reviewId] });
      qc.invalidateQueries({ queryKey: ['form-builder', 'reviews'] });
    },
  });
}

// ---- Update synthesis ----
export function useUpdateReviewSynthesis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, synthesis }: { reviewId: string; synthesis: string }) =>
      fb.put<{ data: ReviewEntity }>(`/reviews/${reviewId}/synthesis`, { synthesis }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'review', vars.reviewId] });
      qc.invalidateQueries({ queryKey: ['form-builder', 'reviews'] });
    },
  });
}

// ---- Close review ----
export function useCloseReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) =>
      fb.post<{ data: ReviewEntity }>(`/reviews/${reviewId}/close`),
    onSuccess: (_, reviewId) => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'review', reviewId] });
      qc.invalidateQueries({ queryKey: ['form-builder', 'reviews'] });
    },
  });
}

// ===========================================================================
// ── Form Extensions (campaign-scoped field additions by REC/Country) ──
// ===========================================================================

export interface FormExtensionFieldEntity {
  id: string;
  extensionId: string;
  fieldKey: string;
  labelI18n: Record<string, string>;
  type: string;
  required: boolean;
  validationRules: unknown | null;
  referenceDataId: string | null;
  properties: unknown | null;
  order: number;
  createdAt: string;
}

export interface FormExtensionEntity {
  id: string;
  baseFormId: string;
  baseFormVersion: number;
  campaignId: string;
  level: 'REC' | 'COUNTRY';
  tenantId: string;
  version: number;
  status: 'DRAFT' | 'PENDING_VALIDATION' | 'PUBLISHED' | 'ARCHIVED';
  createdBy: string;
  validatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  fields: FormExtensionFieldEntity[];
}

export interface EffectiveField {
  id: string;
  fieldKey: string;
  label: unknown;
  type: string;
  required: boolean;
  order: number;
  origin: 'base' | 'extension';
  locked: boolean;
  section?: string;
  validation?: unknown;
  properties?: unknown;
  referenceDataId?: string | null;
}

export interface EffectiveForm {
  template: { id: string; name: string; version: number; schema: unknown };
  baseFields: EffectiveField[];
  extensionFields: EffectiveField[];
  allFields: EffectiveField[];
  extension: { id: string; level: string; tenantId: string; version: number } | null;
}

// ---- List extensions for a base form + campaign ----
export function useFormExtensions(
  baseFormId: string | undefined,
  params?: { campaignId?: string; tenantId?: string; page?: number; limit?: number },
) {
  return useQuery({
    queryKey: ['form-builder', 'extensions', baseFormId, params],
    queryFn: () =>
      fb.get<{ data: FormExtensionEntity[]; meta: { total: number; page: number; limit: number } }>(
        `/forms/${baseFormId}/extensions`,
        {
          ...(params?.campaignId && { campaignId: params.campaignId }),
          ...(params?.tenantId && { tenantId: params.tenantId }),
          ...(params?.page && { page: String(params.page) }),
          ...(params?.limit && { limit: String(params.limit) }),
        },
      ),
    enabled: !!baseFormId && !!params?.campaignId,
  });
}

// ---- Get a single extension ----
export function useFormExtension(extensionId: string | undefined) {
  return useQuery({
    queryKey: ['form-builder', 'extension', extensionId],
    queryFn: () =>
      fb.get<{ data: FormExtensionEntity }>(`/extensions/${extensionId}`),
    enabled: !!extensionId,
  });
}

// ---- Create extension ----
export function useCreateExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { baseFormId: string; campaignId: string; level: 'REC' | 'COUNTRY'; tenantId: string }) =>
      fb.post<{ data: FormExtensionEntity }>(`/forms/${data.baseFormId}/extensions`, {
        campaignId: data.campaignId,
        level: data.level,
        tenantId: data.tenantId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'extensions'] });
    },
  });
}

// ---- Add field to extension ----
export function useAddExtensionField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      extensionId: string;
      fieldKey: string;
      labelI18n: Record<string, string>;
      type: string;
      required?: boolean;
      validationRules?: unknown;
      referenceDataId?: string;
      properties?: unknown;
      order?: number;
    }) =>
      fb.post<{ data: FormExtensionFieldEntity }>(`/extensions/${data.extensionId}/fields`, {
        fieldKey: data.fieldKey,
        labelI18n: data.labelI18n,
        type: data.type,
        required: data.required,
        validationRules: data.validationRules,
        referenceDataId: data.referenceDataId,
        properties: data.properties,
        order: data.order,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'extension', vars.extensionId] });
      qc.invalidateQueries({ queryKey: ['form-builder', 'extensions'] });
    },
  });
}

// ---- Update extension field ----
export function useUpdateExtensionField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      extensionId: string;
      fieldId: string;
      fieldKey?: string;
      labelI18n?: Record<string, string>;
      type?: string;
      required?: boolean;
      validationRules?: unknown | null;
      referenceDataId?: string | null;
      properties?: unknown | null;
      order?: number;
    }) => {
      const { extensionId, fieldId, ...body } = data;
      return fb.patch<{ data: FormExtensionFieldEntity }>(`/extensions/${extensionId}/fields/${fieldId}`, body);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'extension', vars.extensionId] });
    },
  });
}

// ---- Delete extension field ----
export function useDeleteExtensionField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { extensionId: string; fieldId: string }) =>
      fb.del(`/extensions/${data.extensionId}/fields/${data.fieldId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'extension', vars.extensionId] });
      qc.invalidateQueries({ queryKey: ['form-builder', 'extensions'] });
    },
  });
}

// ---- Submit extension for validation ----
export function useSubmitExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (extensionId: string) =>
      fb.post<{ data: FormExtensionEntity }>(`/extensions/${extensionId}/submit`),
    onSuccess: (_, extensionId) => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'extension', extensionId] });
      qc.invalidateQueries({ queryKey: ['form-builder', 'extensions'] });
    },
  });
}

// ---- Publish extension ----
export function usePublishExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (extensionId: string) =>
      fb.post<{ data: FormExtensionEntity }>(`/extensions/${extensionId}/publish`),
    onSuccess: (_, extensionId) => {
      qc.invalidateQueries({ queryKey: ['form-builder', 'extension', extensionId] });
      qc.invalidateQueries({ queryKey: ['form-builder', 'extensions'] });
    },
  });
}

// ---- Get effective form (base + extension) ----
export function useEffectiveForm(
  campaignId: string | undefined,
  baseFormId: string | undefined,
  tenantId: string | undefined,
) {
  return useQuery({
    queryKey: ['form-builder', 'effective-form', campaignId, baseFormId, tenantId],
    queryFn: () =>
      fb.get<EffectiveForm>(
        `/campaigns/${campaignId}/forms/${baseFormId}/effective`,
        { tenantId: tenantId! },
      ),
    enabled: !!campaignId && !!baseFormId && !!tenantId,
  });
}
