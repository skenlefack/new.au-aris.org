'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsClient } from './client';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface IndicatorType {
  code: string;
  labelFr: string;
  labelEn: string;
  labelAr?: string | null;
  labelPt?: string | null;
  description?: string | null;
  color?: string | null;
  iconName?: string | null;
  externalRef?: string | null;
  active: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export type IndicatorMeasurementMode =
  | 'MANUAL_ENTRY'
  | 'AUTO_FROM_FORM'
  | 'AUTO_FROM_KPI_SOURCE'
  | 'COMPOSITE_FORMULA';

export type IndicatorScope =
  | 'CONTINENTAL'
  | 'REGIONAL'
  | 'NATIONAL'
  | 'SUB_NATIONAL'
  | 'CROSS_CUTTING';

export type IndicatorAggregation =
  | 'SUM' | 'AVERAGE' | 'MIN' | 'MAX' | 'MEDIAN'
  | 'COUNT' | 'WEIGHTED_AVG' | 'LATEST' | 'CUSTOM';

export type IndicatorPeriodicity =
  | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'ON_DEMAND';

export interface Indicator {
  id: string;
  code: string;
  typeCode: string;
  type?: IndicatorType;
  nameFr: string;
  nameEn: string;
  nameAr?: string | null;
  namePt?: string | null;
  descriptionFr?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  descriptionPt?: string | null;
  domainId?: string | null;
  subDomainId?: string | null;
  valueChainCode?: string | null;
  scope?: IndicatorScope | null;
  measurementMode?: IndicatorMeasurementMode | null;
  aggregation?: IndicatorAggregation | null;
  periodicity?: IndicatorPeriodicity | null;
  unit?: string | null;
  decimalPlaces?: number;
  targetValue?: number | null;
  betterIsHigher?: boolean;
  isPublic?: boolean;
  externalFrameworkReference?: string | null;
  notes?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IndicatorValue {
  id: string;
  indicatorId: string;
  year: number;
  month?: number | null;
  quarter?: number | null;
  countryCode?: string | null;
  recCode?: string | null;
  isContinental?: boolean;
  value: number;
  source?: string | null;
  notes?: string | null;
  createdAt?: string;
}

export interface IndicatorListParams {
  typeCode?: string;
  domainId?: string;
  subDomainId?: string;
  measurementMode?: IndicatorMeasurementMode;
  active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IndicatorValueParams {
  year?: number;
  countryCode?: string;
  recCode?: string;
  page?: number;
  limit?: number;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

/* ------------------------------------------------------------------ */
/*  API paths                                                          */
/* ------------------------------------------------------------------ */

const BASE = '/analytics';

/* ------------------------------------------------------------------ */
/*  Indicator Types                                                    */
/* ------------------------------------------------------------------ */

export function useIndicatorTypes() {
  return useQuery<{ data: IndicatorType[] }>({
    queryKey: ['indicator-types'],
    queryFn: () => analyticsClient.get<{ data: IndicatorType[] }>(`${BASE}/indicator-types`),
    staleTime: 10 * 60_000,
  });
}

export function useCreateIndicatorType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<IndicatorType, 'active' | 'displayOrder' | 'createdAt' | 'updatedAt'> & { displayOrder?: number }) =>
      analyticsClient.post<{ data: IndicatorType }>(`${BASE}/admin/indicator-types`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['indicator-types'] }),
  });
}

export function useUpdateIndicatorType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, ...body }: { code: string } & Record<string, unknown>) =>
      analyticsClient.patch<{ data: IndicatorType }>(`${BASE}/admin/indicator-types/${code}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['indicator-types'] }),
  });
}

export function useDeleteIndicatorType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      analyticsClient.delete<void>(`${BASE}/admin/indicator-types/${code}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['indicator-types'] }),
  });
}

/* ------------------------------------------------------------------ */
/*  Indicators                                                         */
/* ------------------------------------------------------------------ */

export function useIndicators(params?: IndicatorListParams) {
  const qs: Record<string, string> = {};
  if (params?.typeCode) qs.typeCode = params.typeCode;
  if (params?.domainId) qs.domainId = params.domainId;
  if (params?.subDomainId) qs.subDomainId = params.subDomainId;
  if (params?.measurementMode) qs.measurementMode = params.measurementMode;
  if (params?.active !== undefined) qs.active = String(params.active);
  if (params?.search) qs.search = params.search;
  if (params?.page) qs.page = String(params.page);
  if (params?.limit) qs.limit = String(params.limit);

  return useQuery<PaginatedResponse<Indicator>>({
    queryKey: ['indicators', params],
    queryFn: () => analyticsClient.get<PaginatedResponse<Indicator>>(`${BASE}/indicators`, qs),
    staleTime: 5 * 60_000,
  });
}

export function useIndicator(id: string) {
  return useQuery<{ data: Indicator }>({
    queryKey: ['indicators', id],
    queryFn: () => analyticsClient.get<{ data: Indicator }>(`${BASE}/indicators/${id}`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useCreateIndicator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      analyticsClient.post<{ data: Indicator }>(`${BASE}/admin/indicators`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['indicators'] }),
  });
}

export function useUpdateIndicator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      analyticsClient.patch<{ data: Indicator }>(`${BASE}/admin/indicators/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['indicators'] }),
  });
}

export function useDeleteIndicator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      analyticsClient.delete<void>(`${BASE}/admin/indicators/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['indicators'] }),
  });
}

/* ------------------------------------------------------------------ */
/*  Indicator Values                                                   */
/* ------------------------------------------------------------------ */

export function useIndicatorValues(indicatorId: string, params?: IndicatorValueParams) {
  const qs: Record<string, string> = {};
  if (params?.year) qs.year = String(params.year);
  if (params?.countryCode) qs.countryCode = params.countryCode;
  if (params?.recCode) qs.recCode = params.recCode;
  if (params?.page) qs.page = String(params.page);
  if (params?.limit) qs.limit = String(params.limit);

  return useQuery<PaginatedResponse<IndicatorValue>>({
    queryKey: ['indicator-values', indicatorId, params],
    queryFn: () => analyticsClient.get<PaginatedResponse<IndicatorValue>>(
      `${BASE}/indicators/${indicatorId}/values`, qs,
    ),
    enabled: !!indicatorId,
    staleTime: 5 * 60_000,
  });
}

export function useCreateIndicatorValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ indicatorId, ...body }: { indicatorId: string } & Record<string, unknown>) =>
      analyticsClient.post<{ data: IndicatorValue }>(
        `${BASE}/indicators/${indicatorId}/values`, body,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['indicator-values'] }),
  });
}

export function useBulkCreateIndicatorValues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ indicatorId, values }: { indicatorId: string; values: Record<string, unknown>[] }) =>
      analyticsClient.post<{ data: { created: number } }>(
        `${BASE}/indicators/${indicatorId}/values/bulk`, { values },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['indicator-values'] }),
  });
}
