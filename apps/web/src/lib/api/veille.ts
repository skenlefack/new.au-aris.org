// React Query hooks for the Veille (information watch) module — services/veille.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { useAuthStore } from '@/lib/stores/auth-store';

export type SignalStatus = 'NEW' | 'IN_REVIEW' | 'TO_VERIFY' | 'VALIDATED' | 'REJECTED' | 'INTEGRATED';
export const SIGNAL_STATUSES: SignalStatus[] = ['NEW', 'IN_REVIEW', 'TO_VERIFY', 'VALIDATED', 'REJECTED', 'INTEGRATED'];
export const SIGNAL_CATEGORIES = ['outbreak', 'trade', 'market', 'policy', 'climate', 'wildlife', 'production', 'other'];
export const RELIABILITY_LEVELS = ['A', 'B', 'C', 'D', 'E', 'F'];
export const CONFIDENCE_LEVELS = ['RUMOR', 'VERIFIED', 'CONFIRMED'];

/** Same transitions as the backend; INTEGRATED goes through the integrate action. */
export const NEXT_STATUSES: Record<SignalStatus, SignalStatus[]> = {
  NEW: ['IN_REVIEW', 'TO_VERIFY', 'VALIDATED', 'REJECTED'],
  IN_REVIEW: ['TO_VERIFY', 'VALIDATED', 'REJECTED'],
  TO_VERIFY: ['IN_REVIEW', 'VALIDATED', 'REJECTED'],
  VALIDATED: ['IN_REVIEW', 'REJECTED'],
  REJECTED: ['IN_REVIEW'],
  INTEGRATED: [],
};

export interface WatchSource {
  id: string;
  name: string;
  type: 'RSS' | 'GDELT';
  url: string;
  countryCode: string | null;
  language: string | null;
  reliability: string;
  intervalMinutes: number;
  isActive: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastItemCount: number;
  signalCount?: number;
}

export interface WatchList {
  id: string;
  name: string;
  description: string | null;
  domain: string;
  campaignId: string | null;
  anyTerms: string[];
  allTerms: string[];
  excludeTerms: string[];
  countries: string[];
  isActive: boolean;
}

export interface WatchSignal {
  id: string;
  sourceId: string;
  url: string;
  title: string;
  excerpt: string | null;
  language: string | null;
  publishedAt: string | null;
  collectedAt: string;
  domain: string;
  category: string;
  countries: string[];
  matchedTerms: string[];
  relevance: number;
  severity: number;
  priority: number;
  reliability: string;
  confidence: string;
  aiSummary: string | null;
  aiClassification: { summary_fr?: string; summary_en?: string; domain?: string; category?: string; severity?: number; relevant?: boolean } | null;
  status: SignalStatus;
  dataClassification: string;
  campaignId: string | null;
  integrationTarget: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  /** lead signal of the story this article belongs to; null when it leads its own group */
  clusterId: string | null;
  /** articles reporting the story, lead included */
  clusterSize: number;
  source?: { id: string; name: string; type: string; url?: string };
  /** other outlets reporting the same story (detail view of a lead) */
  members?: Array<{ id: string; title: string; url: string; language: string | null; publishedAt: string | null; reliability: string; countries: string[]; source?: { name: string } }>;
  actions?: Array<{ id: string; action: string; fromStatus: string | null; toStatus: string | null; note: string | null; actorRole: string; createdAt: string }>;
}

export interface SignalFilters {
  status?: string;
  domain?: string;
  category?: string;
  severity?: string;
  country?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface VeilleStats {
  byStatus: Record<string, number>;
  byDomain: Record<string, number>;
  byCategory: Record<string, number>;
  last7Days: number;
  openAlerts: number;
  sources: { total: number; active: number; failing: number };
}

const KEY = 'veille';

function toQuery(f: SignalFilters): Record<string, string> {
  const q: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '') q[k] = String(v);
  return q;
}

export function useVeilleStats() {
  return useQuery({ queryKey: [KEY, 'stats'], queryFn: () => apiClient.get<{ data: VeilleStats }>('/veille/stats'), refetchInterval: 60_000 });
}

export function useWatchSignals(filters: SignalFilters) {
  return useQuery({
    queryKey: [KEY, 'signals', filters],
    queryFn: () => apiClient.get<{ data: WatchSignal[]; meta: { total: number; page: number; limit: number } }>('/veille/signals', toQuery(filters)),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });
}

export function useWatchSignal(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'signal', id],
    queryFn: () => apiClient.get<{ data: WatchSignal }>(`/veille/signals/${id}`),
    enabled: !!id,
  });
}

export function useWatchSources() {
  return useQuery({ queryKey: [KEY, 'sources'], queryFn: () => apiClient.get<{ data: WatchSource[] }>('/veille/sources') });
}

export function useWatchLists() {
  return useQuery({ queryKey: [KEY, 'watchlists'], queryFn: () => apiClient.get<{ data: WatchList[] }>('/veille/watchlists') });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useReviewSignal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: SignalStatus; note?: string; category?: string; severity?: number; confidence?: string; domain?: string; countries?: string[] }) =>
      apiClient.patch<{ data: WatchSignal }>(`/veille/signals/${id}`, body),
    onSuccess: invalidate,
  });
}

/** Take an article out of a story it was wrongly grouped with. */
export function useDetachSignal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<{ data: WatchSignal }>(`/veille/signals/${id}/detach`, {}),
    onSuccess: invalidate,
  });
}

export function useIntegrateSignal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; target: 'campaign' | 'dataset'; campaignId?: string; dataClassification?: string; note?: string }) =>
      apiClient.post<{ data: WatchSignal }>(`/veille/signals/${id}/integrate`, body),
    onSuccess: invalidate,
  });
}

export function useSaveSource() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<WatchSource>) =>
      id ? apiClient.patch<{ data: WatchSource }>(`/veille/sources/${id}`, body) : apiClient.post<{ data: WatchSource }>('/veille/sources', body),
    onSuccess: invalidate,
  });
}

export function useDeleteSource() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => apiClient.delete(`/veille/sources/${id}`), onSuccess: invalidate });
}

export function useRunSource() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: { fetched: number; created: number; duplicates: number; unmatched: number; error?: string } }>(`/veille/sources/${id}/run`),
    onSuccess: invalidate,
  });
}

export function useSaveWatchList() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<WatchList>) =>
      id ? apiClient.patch<{ data: WatchList }>(`/veille/watchlists/${id}`, body) : apiClient.post<{ data: WatchList }>('/veille/watchlists', body),
    onSuccess: invalidate,
  });
}

export function useDeleteWatchList() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => apiClient.delete(`/veille/watchlists/${id}`), onSuccess: invalidate });
}

/** Download the published watch dataset as CSV. */
export async function downloadVeilleDataset(): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1';
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${base}/veille/dataset?format=csv`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `aris-veille-signals-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
