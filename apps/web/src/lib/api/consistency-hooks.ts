'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/** Consistency review of collected submissions (collecte service). */

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ConsistencyIssue {
  code: string;
  severity: IssueSeverity;
  fields: string[];
  message: string;
  params?: Record<string, string | number>;
  suggestion?: { field: string; value: unknown; label?: string; approximate?: boolean };
}

export interface IssueFieldMeta {
  label: unknown;
  type: string;
  options?: { value: string; label: unknown }[];
  min?: number;
  max?: number;
}

export interface ConsistencyResult {
  submissionId: string;
  version: number;
  status: string;
  submittedBy: string;
  issues: ConsistencyIssue[];
  fields: Record<string, IssueFieldMeta>;
  summary: { error: number; warning: number; info: number };
  checkedAt: string;
}

export interface ReviewHistoryEntry {
  id: string;
  action: 'REQUEST_CORRECTION' | 'CORRECT' | 'RESUBMIT' | 'VALIDATE' | 'REJECT' | 'RETURN';
  reason: string | null;
  previous: Record<string, unknown> | null;
  next: Record<string, unknown> | null;
  at: string;
  actor: { id: string | null; role: string | null; name: string | null };
}

const COLLECTE_BASE = process.env['NEXT_PUBLIC_COLLECTE_URL'] ?? '';

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const raw = localStorage.getItem('aris-auth');
    if (raw) {
      const state = JSON.parse(raw)?.state;
      if (state?.accessToken) h['Authorization'] = `Bearer ${state.accessToken}`;
      if (state?.user?.tenantId) h['X-Tenant-Id'] = state.user.tenantId;
    }
  } catch { /* ignore */ }
  return h;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${COLLECTE_BASE}/api/v1/collecte/submissions${path}`, { ...init, headers: { ...headers(), ...((init?.headers ?? {}) as Record<string, string>) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export function useSubmissionConsistency(id: string | undefined) {
  return useQuery({
    queryKey: ['collecte', 'consistency', id],
    queryFn: () => call<{ data: ConsistencyResult }>(`/${id}/consistency`).then((r) => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/** Issue counts for a page of submissions (list badges). */
export function useConsistencySummary(ids: string[]) {
  const key = [...ids].sort().join(',');
  return useQuery({
    queryKey: ['collecte', 'consistency-summary', key],
    queryFn: () => call<{ data: Record<string, ConsistencyResult['summary']> }>('/consistency/summary', {
      method: 'POST', body: JSON.stringify({ ids }),
    }).then((r) => r.data),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
}

export function useReviewHistory(id: string | undefined) {
  return useQuery({
    queryKey: ['collecte', 'review-history', id],
    queryFn: () => call<{ data: ReviewHistoryEntry[] }>(`/${id}/review-history`).then((r) => r.data),
    enabled: !!id,
  });
}

function useInvalidateReview() {
  const qc = useQueryClient();
  return (id: string) => {
    qc.invalidateQueries({ queryKey: ['collecte', 'consistency', id] });
    qc.invalidateQueries({ queryKey: ['collecte', 'consistency-summary'] });
    qc.invalidateQueries({ queryKey: ['collecte', 'review-history', id] });
    qc.invalidateQueries({ queryKey: ['collecte', 'submissions', id] });
    qc.invalidateQueries({ queryKey: ['workflow'] });
    qc.invalidateQueries({ queryKey: ['campaign-submissions'] });
  };
}

/** Validator corrects fields directly (kept in the audit trail). */
export function useCorrectSubmission() {
  const invalidate = useInvalidateReview();
  return useMutation({
    mutationFn: ({ id, changes, reason }: { id: string; changes: Record<string, unknown>; reason: string }) =>
      call<{ data: { id: string; data: Record<string, unknown>; version: number } }>(`/${id}/corrections`, {
        method: 'PATCH', body: JSON.stringify({ changes, reason }),
      }),
    onSuccess: (_r, v) => invalidate(v.id),
  });
}

/** Send the submission back to the collector with the points to fix. */
export function useRequestCorrection() {
  const invalidate = useInvalidateReview();
  return useMutation({
    mutationFn: ({ id, message, items }: { id: string; message: string; items: { field?: string; code?: string; message: string }[] }) =>
      call<{ data: { id: string; status: string } }>(`/${id}/request-correction`, {
        method: 'POST', body: JSON.stringify({ message, items }),
      }),
    onSuccess: (_r, v) => invalidate(v.id),
  });
}
