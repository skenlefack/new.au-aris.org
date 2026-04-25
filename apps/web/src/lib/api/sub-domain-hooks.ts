'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type { SubDomain, SubDomainType, ValueChainCode } from '@/lib/stores/domain-store';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SubDomainListParams {
  page?: number;
  limit?: number;
  domainCode?: string;
  typeEnum?: SubDomainType;
  active?: string; // 'true' | 'false'
  valueChainCode?: string;
  search?: string;
}

export interface SubDomainCreateBody {
  code: string;
  domainCode: string;
  valueChainCode?: string | null;
  labelFr: string;
  labelEn: string;
  labelAr?: string | null;
  labelPt?: string | null;
  typeEnum: SubDomainType;
  active?: boolean;
  displayOrder?: number;
  description?: string | null;
}

export interface SubDomainUpdateBody {
  labelFr?: string;
  labelEn?: string;
  labelAr?: string | null;
  labelPt?: string | null;
  valueChainCode?: string | null;
  typeEnum?: SubDomainType;
  active?: boolean;
  displayOrder?: number;
  description?: string | null;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

const BASE = '/credential/admin/sub-domains';

export function useAdminSubDomains(params?: SubDomainListParams) {
  const qs: Record<string, string> = {};
  if (params?.page) qs.page = String(params.page);
  if (params?.limit) qs.limit = String(params.limit);
  if (params?.domainCode) qs.domainCode = params.domainCode;
  if (params?.typeEnum) qs.typeEnum = params.typeEnum;
  if (params?.active) qs.active = params.active;
  if (params?.valueChainCode) qs.valueChainCode = params.valueChainCode;
  if (params?.search) qs.search = params.search;

  return useQuery<PaginatedResponse<SubDomain & { domain?: { code: string; name: Record<string, string> } }>>({
    queryKey: ['admin', 'sub-domains', params],
    queryFn: () => apiClient.get(BASE, qs),
    staleTime: 30_000,
  });
}

export function useAdminSubDomain(id: string) {
  return useQuery<{ data: SubDomain & { domain?: { code: string; name: Record<string, string> } } }>({
    queryKey: ['admin', 'sub-domains', id],
    queryFn: () => apiClient.get(`${BASE}/${id}`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateSubDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubDomainCreateBody) =>
      apiClient.post<{ data: SubDomain }>(BASE, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sub-domains'] });
    },
  });
}

export function useUpdateSubDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & SubDomainUpdateBody) =>
      apiClient.patch<{ data: SubDomain }>(`${BASE}/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sub-domains'] });
    },
  });
}

export function useDeleteSubDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<{ data: { id: string; deleted: boolean } }>(`${BASE}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sub-domains'] });
    },
  });
}

/** Fetch all domains for the domain selector */
export function useAllDomains() {
  return useQuery<{ data: Array<{ id: string; code: string; name: Record<string, string>; color: string }> }>({
    queryKey: ['credential', 'domains'],
    queryFn: () => apiClient.get('/credential/domains'),
    staleTime: 5 * 60_000,
  });
}

/** Fetch all value chain codes for the selector */
export function useAllValueChainCodes() {
  return useQuery<{ data: ValueChainCode[] }>({
    queryKey: ['credential', 'value-chain-codes'],
    queryFn: () => apiClient.get('/credential/value-chain-codes'),
    staleTime: 5 * 60_000,
  });
}
