'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const INGEST_API = process.env['NEXT_PUBLIC_INGEST_URL'] ?? '';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const raw = localStorage.getItem('aris-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      const token = parsed?.state?.accessToken;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const tenantId = parsed?.state?.user?.tenantId;
      if (tenantId) headers['X-Tenant-Id'] = tenantId;
    }
  } catch { /* ignore */ }
  return headers;
}

async function ingestFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${INGEST_API}${path}`, { headers: getHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as Record<string, string>).message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

async function ingestPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${INGEST_API}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as Record<string, string>).message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Files ──

export function useIngestFiles(params?: { page?: number; limit?: number; status?: string }) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.status) qs.set('status', params.status);
  const query = qs.toString() ? `?${qs}` : '';
  return useQuery({
    queryKey: ['ingest', 'files', params],
    queryFn: () => ingestFetch(`/api/v1/ingest/files${query}`),
    staleTime: 30_000,
  });
}

export function useIngestFile(id?: string) {
  return useQuery({
    queryKey: ['ingest', 'file', id],
    queryFn: () => ingestFetch(`/api/v1/ingest/files/${id}`),
    enabled: !!id,
    refetchInterval: 5000, // Poll for status updates
  });
}

export function useIngestProfile(id?: string) {
  return useQuery({
    queryKey: ['ingest', 'profile', id],
    queryFn: () => ingestFetch(`/api/v1/ingest/files/${id}/profile`),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useIngestProposals(id?: string) {
  return useQuery({
    queryKey: ['ingest', 'proposals', id],
    queryFn: () => ingestFetch(`/api/v1/ingest/files/${id}/proposals`),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useIngestQualityReport(id?: string) {
  return useQuery({
    queryKey: ['ingest', 'quality-report', id],
    queryFn: () => ingestFetch(`/api/v1/ingest/files/${id}/quality-report`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useUploadIngestFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { 'Content-Type': _, ...headers } = getHeaders();
      const res = await fetch(`${INGEST_API}/api/v1/ingest/files`, {
        method: 'POST',
        headers,
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).message ?? 'Upload failed');
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingest', 'files'] }),
  });
}

export function useConfirmMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, ...body }: { fileId: string; proposalId: string; corrections?: unknown[] }) =>
      ingestPost(`/api/v1/ingest/files/${fileId}/mapping`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingest'] }),
  });
}

export function useResolveCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, ...body }: { fileId: string; campaignId?: string; isNewCampaign?: boolean }) =>
      ingestPost(`/api/v1/ingest/files/${fileId}/campaign`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingest'] }),
  });
}

export function useStartDryRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => ingestPost(`/api/v1/ingest/files/${fileId}/dry-run`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingest'] }),
  });
}

export function useCommitIngest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => ingestPost(`/api/v1/ingest/files/${fileId}/commit`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingest'] }),
  });
}

export function useCancelIngest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => ingestPost(`/api/v1/ingest/files/${fileId}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingest'] }),
  });
}
