// React Query hooks for the Knowledge Management System.
//
// Wraps the knowledge-hub backend (services/knowledge-hub, port 3033) and
// covers categories, publications (CRUD + workflow), the public Google-style
// search, and the publishable-categories picker used by the create form.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { knowledgeHubClient } from './client';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CategoryScope = 'CONTINENTAL' | 'REC' | 'COUNTRY';
export type PublicationType =
  | 'ARTICLE' | 'REPORT' | 'BRIEF' | 'GUIDELINE' | 'NEWS' | 'EVENT'
  | 'FAQ' | 'DATASET' | 'INFOGRAPHIC' | 'VIDEO' | 'ANNOUNCEMENT';
export type PublicationStatus =
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'ARCHIVED';
export type Visibility = 'PUBLIC' | 'PRIVATE';
export type ReviewDecision = 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGES' | 'COMMENT';
export type AttachmentKind = 'DOCUMENT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'ARCHIVE' | 'OTHER';

export type LocalisedText = Partial<Record<'en' | 'fr' | 'pt' | 'ar', string>>;

export type CategoryStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface KnowledgeCategory {
  id: string;
  parentId: string | null;
  slug: string;
  nameEn: string;
  nameFr: string | null;
  namePt: string | null;
  nameAr: string | null;
  descriptionEn: string | null;
  scope: CategoryScope;
  scopeTenantId: string | null;
  recParentTenantId: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  status: CategoryStatus;
  submittedBy: string | null;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  publicationCount?: number;
  children?: KnowledgeCategory[];
}

export interface PublicationAttachment {
  id: string;
  fileId: string;
  caption: string | null;
  kind: AttachmentKind;
  sortOrder: number;
}

export interface PublicationReview {
  id: string;
  reviewerId: string;
  reviewerRole: string;
  decision: ReviewDecision;
  comment: string | null;
  createdAt: string;
}

export interface KnowledgePublication {
  id: string;
  tenantId: string;
  categoryId: string;
  category?: KnowledgeCategory;
  title: LocalisedText;
  summary: LocalisedText | null;
  contentHtml: LocalisedText;
  contentText: LocalisedText | null;
  slug: string;
  type: PublicationType;
  status: PublicationStatus;
  visibility: Visibility;
  dataClassification: 'PUBLIC' | 'PARTNER' | 'RESTRICTED' | 'CONFIDENTIAL';
  authors: string[];
  tags: string[];
  coverImageId: string | null;
  createdBy: string;
  updatedBy: string;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  viewCount: number;
  downloadCount: number;
  attachments?: PublicationAttachment[];
  reviews?: PublicationReview[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicationListResponse {
  data: KnowledgePublication[];
  meta: { total: number; page: number; limit: number };
}

export interface SearchHit {
  id: string;
  slug: string;
  title: LocalisedText;
  summary: LocalisedText | null;
  type: PublicationType;
  categoryId: string;
  categorySlug: string | null;
  scope: CategoryScope;
  scopeTenantId: string | null;
  publishedAt: string | null;
  tags: string[];
  authors: string[];
  visibility: Visibility;
  highlight?: string;
}

export interface SearchResponse {
  data: {
    total: number;
    page: number;
    limit: number;
    hits: SearchHit[];
    facets: {
      categories: { id: string; count: number }[];
      types: { value: string; count: number }[];
      scopes: { value: string; count: number }[];
    };
  };
}

// ─── Categories ─────────────────────────────────────────────────────────────

export function useCategoryTree(opts?: { withCounts?: boolean; scope?: CategoryScope; auth?: boolean }) {
  const params: Record<string, string> = { tree: 'true' };
  if (opts?.withCounts) params.withCounts = 'true';
  if (opts?.scope) params.scope = opts.scope;
  const path = opts?.auth === false
    ? '/knowledge/categories/public'
    : '/knowledge/categories';

  return useQuery({
    queryKey: ['knowledge', 'categories', 'tree', opts],
    queryFn: () => knowledgeHubClient.get<{ data: KnowledgeCategory[] }>(path, params),
    staleTime: 5 * 60_000,
  });
}

export function usePublishableCategories() {
  return useQuery({
    queryKey: ['knowledge', 'categories', 'publishable'],
    queryFn: () => knowledgeHubClient.get<{ data: KnowledgeCategory[] }>('/knowledge/categories/publishable'),
    staleTime: 60_000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<KnowledgeCategory> & { scope: CategoryScope; slug: string; nameEn: string }) =>
      knowledgeHubClient.post<{ data: KnowledgeCategory }>('/knowledge/categories', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge', 'categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<KnowledgeCategory>) =>
      knowledgeHubClient.patch<{ data: KnowledgeCategory }>(`/knowledge/categories/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge', 'categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeHubClient.delete<{ data: { deleted: boolean } }>(`/knowledge/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge', 'categories'] }),
  });
}

// ─── Category review (continental managers only) ────────────────────────────

export function useCategoryReviewQueue() {
  return useQuery({
    queryKey: ['knowledge', 'categories', 'review-queue'],
    queryFn: () =>
      knowledgeHubClient.get<{ data: KnowledgeCategory[] }>('/knowledge/categories/review-queue'),
    refetchInterval: 60_000,
  });
}

export function useReviewCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, comment }: { id: string; decision: 'APPROVED' | 'REJECTED'; comment?: string }) =>
      knowledgeHubClient.post<{ data: KnowledgeCategory }>(
        `/knowledge/categories/${id}/review`,
        { decision, comment },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge', 'categories'] });
    },
  });
}

// ─── Publications ───────────────────────────────────────────────────────────

export function usePublications(params?: {
  page?: number;
  limit?: number;
  categoryId?: string;
  type?: PublicationType;
  status?: PublicationStatus;
  visibility?: Visibility;
  mine?: boolean;
  search?: string;
}) {
  const qp: Record<string, string> = {};
  if (params?.page) qp.page = String(params.page);
  if (params?.limit) qp.limit = String(params.limit);
  if (params?.categoryId) qp.categoryId = params.categoryId;
  if (params?.type) qp.type = params.type;
  if (params?.status) qp.status = params.status;
  if (params?.visibility) qp.visibility = params.visibility;
  if (params?.mine) qp.mine = 'true';
  if (params?.search) qp.search = params.search;

  return useQuery({
    queryKey: ['knowledge', 'publications', params],
    queryFn: () => knowledgeHubClient.get<PublicationListResponse>('/knowledge/publications', qp),
  });
}

export function usePublication(id: string | undefined) {
  return useQuery({
    queryKey: ['knowledge', 'publications', id],
    queryFn: () => knowledgeHubClient.get<{ data: KnowledgePublication }>(`/knowledge/publications/${id}`),
    enabled: !!id,
  });
}

export function useCreatePublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: any) => knowledgeHubClient.post<{ data: KnowledgePublication }>('/knowledge/publications', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge', 'publications'] }),
  });
}

export function useUpdatePublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & any) =>
      knowledgeHubClient.patch<{ data: KnowledgePublication }>(`/knowledge/publications/${id}`, input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['knowledge', 'publications'] });
      qc.invalidateQueries({ queryKey: ['knowledge', 'publications', vars.id] });
    },
  });
}

export function useDeletePublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeHubClient.delete<{ data: { deleted: boolean } }>(`/knowledge/publications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge', 'publications'] }),
  });
}

// ─── Workflow transitions ───────────────────────────────────────────────────

export function useSubmitPublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      knowledgeHubClient.post<{ data: KnowledgePublication }>(`/knowledge/publications/${id}/submit`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge', 'publications'] }),
  });
}

export function useReviewPublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, comment }: { id: string; decision: ReviewDecision; comment?: string }) =>
      knowledgeHubClient.post<{ data: KnowledgePublication }>(
        `/knowledge/publications/${id}/review`,
        { decision, comment },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge', 'publications'] });
      qc.invalidateQueries({ queryKey: ['knowledge', 'review-queue'] });
    },
  });
}

export function usePublishPublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      knowledgeHubClient.post<{ data: KnowledgePublication }>(`/knowledge/publications/${id}/publish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge', 'publications'] });
      qc.invalidateQueries({ queryKey: ['knowledge', 'review-queue'] });
    },
  });
}

export function useArchivePublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      knowledgeHubClient.post<{ data: KnowledgePublication }>(`/knowledge/publications/${id}/archive`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge', 'publications'] }),
  });
}

// ─── Reviewer queue ─────────────────────────────────────────────────────────

export function useReviewQueue() {
  return useQuery({
    queryKey: ['knowledge', 'review-queue'],
    queryFn: () =>
      knowledgeHubClient.get<{ data: KnowledgePublication[] }>('/knowledge/publications/review-queue'),
    refetchInterval: 60_000,
  });
}

// ─── Public search (no auth) ────────────────────────────────────────────────

export function useKnowledgeSearch(params: {
  q?: string;
  page?: number;
  limit?: number;
  categoryId?: string;
  type?: PublicationType;
  scope?: CategoryScope;
  scopeTenantId?: string;
  lang?: string;
}) {
  const qp: Record<string, string> = {};
  if (params.q) qp.q = params.q;
  if (params.page) qp.page = String(params.page);
  if (params.limit) qp.limit = String(params.limit);
  if (params.categoryId) qp.categoryId = params.categoryId;
  if (params.type) qp.type = params.type;
  if (params.scope) qp.scope = params.scope;
  if (params.scopeTenantId) qp.scopeTenantId = params.scopeTenantId;
  if (params.lang) qp.lang = params.lang;

  return useQuery({
    queryKey: ['knowledge', 'search', params],
    queryFn: () => knowledgeHubClient.get<SearchResponse>('/knowledge/search', qp),
    enabled: !!(params.q || params.categoryId),
  });
}

export function usePublicCategoryTree(scope?: CategoryScope) {
  const params: Record<string, string> = { tree: 'true', withCounts: 'true' };
  if (scope) params.scope = scope;
  return useQuery({
    queryKey: ['knowledge', 'public-tree', scope],
    queryFn: () => knowledgeHubClient.get<{ data: KnowledgeCategory[] }>('/knowledge/categories/public', params),
    staleTime: 5 * 60_000,
  });
}

export function usePublicPublication(slug: string | undefined) {
  return useQuery({
    queryKey: ['knowledge', 'public-publication', slug],
    queryFn: () => knowledgeHubClient.get<{ data: KnowledgePublication }>(`/knowledge/publications/public/by-slug/${slug}`),
    enabled: !!slug,
  });
}

// ─── Helper: pick localised text by locale with EN fallback ─────────────────

export function pickLocale(text: LocalisedText | null | undefined, locale: string): string {
  if (!text) return '';
  const code = locale.toLowerCase().slice(0, 2) as 'en' | 'fr' | 'pt' | 'ar';
  return text[code] ?? text.en ?? text.fr ?? text.pt ?? text.ar ?? '';
}
