'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsClient } from './client';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ReportType = 'PERIODIC' | 'FLASH' | 'AD_HOC';
export type ReportStatus = 'DRAFT' | 'GENERATING' | 'AWAITING_REVIEW' | 'PUBLISHED' | 'FAILED';
export type SectionType =
  | 'COVER' | 'EXECUTIVE_SUMMARY' | 'INDICATORS_TABLE'
  | 'MAP_AND_TABLE' | 'AI_GENERATED_FROM_DATA' | 'RECOMMENDATIONS'
  | 'ANNEX' | 'FREE_TEXT';
export type SectionStatus = 'PENDING' | 'GENERATED' | 'AI_UNAVAILABLE' | 'EDITED' | 'APPROVED';
export type ReportScope = 'CONTINENTAL' | 'REGIONAL' | 'NATIONAL';
export type ReportLanguage = 'fr' | 'en' | 'pt' | 'ar';

export interface TemplateSection {
  code: string;
  titleFr: string;
  titleEn: string;
  sectionType: SectionType;
  promptTemplate?: string;
  indicatorCodes?: string[];
  displayOrder: number;
  required?: boolean;
}

export interface ReportTemplate {
  id: string;
  code: string;
  nameFr: string;
  nameEn: string;
  type: ReportType;
  domainId?: string | null;
  scope?: ReportScope | null;
  descriptionFr?: string | null;
  descriptionEn?: string | null;
  sections: TemplateSection[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportSection {
  id: string;
  code: string;
  titleFr: string;
  titleEn: string;
  sectionType: SectionType;
  status: SectionStatus;
  contentHtml?: string | null;
  promptUsed?: string | null;
  tokensUsed?: number | null;
  resolvedData?: Record<string, unknown> | null;
  displayOrder: number;
}

export interface Report {
  id: string;
  templateId: string;
  titleFr: string;
  titleEn: string;
  themeFr?: string | null;
  type: ReportType;
  status: ReportStatus;
  scope: ReportScope;
  domainId?: string | null;
  tenantId?: string | null;
  periodStart: string;
  periodEnd: string;
  referenceYear?: number | null;
  language: ReportLanguage;
  generatedBy?: string | null;
  approvedBy?: string | null;
  publishedAt?: string | null;
  sections?: ReportSection[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportStatusResponse {
  id: string;
  status: ReportStatus;
  progress?: number;
  sectionsCompleted?: number;
  sectionsTotal?: number;
  startedAt?: string;
  elapsedMs?: number;
  sections?: Array<{
    code: string;
    status: SectionStatus;
  }>;
}

export interface FlashAlert {
  id: string;
  strategyId?: string;
  code: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  source: string;
  countryCode?: string;
  message: string;
  dataSnapshot?: Record<string, unknown>;
  reportId?: string | null;
  dismissed: boolean;
  dismissedBy?: string | null;
  createdAt: string;
}

export interface FlashStrategy {
  id: string;
  code: string;
  nameFr: string;
  nameEn: string;
  domainId?: string | null;
  indicatorCode: string;
  conditionType: 'THRESHOLD_ABOVE' | 'THRESHOLD_BELOW' | 'PERCENT_CHANGE' | 'ANOMALY';
  conditionValue: number;
  templateId: string;
  cooldownMinutes: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GenerateReportBody {
  templateId: string;
  titleFr: string;
  titleEn: string;
  themeFr?: string;
  scope: ReportScope;
  domainId?: string;
  tenantId?: string;
  periodStart: string;
  periodEnd: string;
  referenceYear?: number;
  language: ReportLanguage;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

/* ------------------------------------------------------------------ */
/*  API base path                                                      */
/* ------------------------------------------------------------------ */

const BASE = '/analytics';

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

export function useReportTemplatesV2(params?: { type?: ReportType }) {
  const qs: Record<string, string> = {};
  if (params?.type) qs.type = params.type;

  return useQuery<{ data: ReportTemplate[] }>({
    queryKey: ['report-templates-v2', params],
    queryFn: () => analyticsClient.get<{ data: ReportTemplate[] }>(`${BASE}/report-templates`, qs),
    staleTime: 5 * 60_000,
  });
}

export function useReportTemplateV2(id: string) {
  return useQuery<{ data: ReportTemplate }>({
    queryKey: ['report-templates-v2', id],
    queryFn: () => analyticsClient.get<{ data: ReportTemplate }>(`${BASE}/report-templates/${id}`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useCreateReportTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      analyticsClient.post<{ data: ReportTemplate }>(`${BASE}/admin/report-templates`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-templates-v2'] }),
  });
}

export function useUpdateReportTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      analyticsClient.patch<{ data: ReportTemplate }>(`${BASE}/admin/report-templates/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-templates-v2'] }),
  });
}

export function useDeleteReportTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      analyticsClient.delete<void>(`${BASE}/admin/report-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-templates-v2'] }),
  });
}

/* ------------------------------------------------------------------ */
/*  Reports                                                            */
/* ------------------------------------------------------------------ */

export interface ReportListParams {
  type?: ReportType;
  status?: ReportStatus;
  domainId?: string;
  scope?: ReportScope;
  page?: number;
  limit?: number;
}

export function useReportsV2(params?: ReportListParams) {
  const qs: Record<string, string> = {};
  if (params?.type) qs.type = params.type;
  if (params?.status) qs.status = params.status;
  if (params?.domainId) qs.domainId = params.domainId;
  if (params?.scope) qs.scope = params.scope;
  if (params?.page) qs.page = String(params.page);
  if (params?.limit) qs.limit = String(params.limit);

  return useQuery<PaginatedResponse<Report>>({
    queryKey: ['reports-v2', params],
    queryFn: () => analyticsClient.get<PaginatedResponse<Report>>(`${BASE}/reports`, qs),
    staleTime: 30_000,
  });
}

export function useReportV2(id: string) {
  return useQuery<{ data: Report }>({
    queryKey: ['reports-v2', id],
    queryFn: () => analyticsClient.get<{ data: Report }>(`${BASE}/reports/${id}`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useGenerateReportV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateReportBody) =>
      analyticsClient.post<{ data: Report }>(`${BASE}/reports/generate`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports-v2'] }),
  });
}

export function useReportStatus(id: string, enabled = false) {
  return useQuery<{ data: ReportStatusResponse }>({
    queryKey: ['report-status', id],
    queryFn: () => analyticsClient.get<{ data: ReportStatusResponse }>(`${BASE}/reports/${id}/status`),
    enabled: !!id && enabled,
    refetchInterval: enabled ? 5_000 : false,
    staleTime: 0,
  });
}

export function useEditReportSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, code, contentHtml }: { reportId: string; code: string; contentHtml: string }) =>
      analyticsClient.post<{ data: ReportSection }>(
        `${BASE}/reports/${reportId}/sections/${code}/edit`,
        { contentHtml },
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['reports-v2', vars.reportId] });
    },
  });
}

export function useRegenerateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, code }: { reportId: string; code: string }) =>
      analyticsClient.post<{ data: ReportSection }>(
        `${BASE}/reports/${reportId}/sections/${code}/regenerate`,
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['reports-v2', vars.reportId] });
    },
  });
}

export function useApproveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      analyticsClient.post<{ data: Report }>(`${BASE}/reports/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports-v2'] }),
  });
}

export function usePublishReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      analyticsClient.post<{ data: Report }>(`${BASE}/reports/${id}/publish`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports-v2'] }),
  });
}

/* ------------------------------------------------------------------ */
/*  Flash Alerts                                                       */
/* ------------------------------------------------------------------ */

export function useFlashAlerts(params?: { page?: number; limit?: number }) {
  const qs: Record<string, string> = {};
  if (params?.page) qs.page = String(params.page);
  if (params?.limit) qs.limit = String(params.limit);

  return useQuery<{ data: FlashAlert[] }>({
    queryKey: ['flash-alerts', params],
    queryFn: () => analyticsClient.get<{ data: FlashAlert[] }>(`${BASE}/flash-alerts`, qs),
    staleTime: 30_000,
  });
}

export function useDismissFlashAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      analyticsClient.post<{ data: FlashAlert }>(`${BASE}/flash-alerts/${id}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flash-alerts'] }),
  });
}

/* ------------------------------------------------------------------ */
/*  Flash Strategies                                                   */
/* ------------------------------------------------------------------ */

export function useFlashStrategies() {
  return useQuery<{ data: FlashStrategy[] }>({
    queryKey: ['flash-strategies'],
    queryFn: () => analyticsClient.get<{ data: FlashStrategy[] }>(`${BASE}/flash-strategies`),
    staleTime: 5 * 60_000,
  });
}

export function useCreateFlashStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      analyticsClient.post<{ data: FlashStrategy }>(`${BASE}/admin/flash-strategies`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flash-strategies'] }),
  });
}

export function useUpdateFlashStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      analyticsClient.patch<{ data: FlashStrategy }>(`${BASE}/admin/flash-strategies/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flash-strategies'] }),
  });
}

export function useDeleteFlashStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      analyticsClient.delete<void>(`${BASE}/admin/flash-strategies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flash-strategies'] }),
  });
}

/* ------------------------------------------------------------------ */
/*  Ollama Health                                                      */
/* ------------------------------------------------------------------ */

export function useOllamaHealth() {
  return useQuery<{ data: { available: boolean; url: string; models: string[] } }>({
    queryKey: ['ollama-health'],
    queryFn: () =>
      analyticsClient.get<{ data: { available: boolean; url: string; models: string[] } }>(
        `${BASE}/ollama/health`,
      ),
    staleTime: 60_000,
  });
}
