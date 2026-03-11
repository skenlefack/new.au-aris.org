'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? '/api/v1';
const COLLECTE_BASE = process.env['NEXT_PUBLIC_COLLECTE_URL'] ?? '';

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

async function wfFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const url = `${COLLECTE_BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: { ...getHeaders(), ...opts?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

// ═══════════════════════════════════════════════════════
// WORKFLOW DEFINITIONS
// ═══════════════════════════════════════════════════════

export function useWorkflowDefinitions(query?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['workflow-definitions', query],
    queryFn: () => {
      const params = new URLSearchParams();
      if (query?.page) params.set('page', String(query.page));
      if (query?.limit) params.set('limit', String(query.limit));
      return wfFetch<any>(`/api/v1/workflow/definitions?${params}`);
    },
  });
}

export function useWorkflowDefinition(id: string | undefined) {
  return useQuery({
    queryKey: ['workflow-definition', id],
    queryFn: () => wfFetch<any>(`/api/v1/workflow/definitions/${id}`),
    enabled: !!id,
  });
}

export function useWorkflowByCountry(code: string | undefined) {
  return useQuery({
    queryKey: ['workflow-country', code],
    queryFn: () => wfFetch<any>(`/api/v1/workflow/definitions/country/${code}`),
    enabled: !!code,
  });
}

export function useCreateWorkflowDef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => wfFetch('/api/v1/workflow/definitions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-definitions'] }),
  });
}

export function useUpdateWorkflowDef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => wfFetch(`/api/v1/workflow/definitions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-definitions'] }),
  });
}

// ── Steps ──

export function useCreateWorkflowStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, ...data }: any) => wfFetch(`/api/v1/workflow/definitions/${workflowId}/steps`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow-definitions'] });
      qc.invalidateQueries({ queryKey: ['workflow-definition'] });
    },
  });
}

export function useUpdateWorkflowStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, stepId, ...data }: any) =>
      wfFetch(`/api/v1/workflow/definitions/${workflowId}/steps/${stepId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-definition'] }),
  });
}

export function useDeleteWorkflowStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, stepId }: { workflowId: string; stepId: string }) =>
      wfFetch(`/api/v1/workflow/definitions/${workflowId}/steps/${stepId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-definition'] }),
  });
}

// ═══════════════════════════════════════════════════════
// VALIDATION CHAINS
// ═══════════════════════════════════════════════════════

export function useValidationChains(query?: { page?: number; limit?: number; userId?: string; validatorId?: string }) {
  return useQuery({
    queryKey: ['validation-chains', query],
    queryFn: () => {
      const params = new URLSearchParams();
      if (query?.page) params.set('page', String(query.page));
      if (query?.limit) params.set('limit', String(query.limit));
      if (query?.userId) params.set('userId', query.userId);
      if (query?.validatorId) params.set('validatorId', query.validatorId);
      return wfFetch<any>(`/api/v1/workflow/validation-chains?${params}`);
    },
  });
}

export function useValidationChainsByUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['validation-chains-user', userId],
    queryFn: () => wfFetch<any>(`/api/v1/workflow/validation-chains/user/${userId}`),
    enabled: !!userId,
  });
}

export function useValidationChainsByValidator(validatorId: string | undefined) {
  return useQuery({
    queryKey: ['validation-chains-validator', validatorId],
    queryFn: () => wfFetch<any>(`/api/v1/workflow/validation-chains/validator/${validatorId}`),
    enabled: !!validatorId,
  });
}

export function useCreateValidationChain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => wfFetch('/api/v1/workflow/validation-chains', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['validation-chains'] }),
  });
}

export function useUpdateValidationChain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => wfFetch(`/api/v1/workflow/validation-chains/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['validation-chains'] }),
  });
}

export function useDeleteValidationChain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => wfFetch(`/api/v1/workflow/validation-chains/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['validation-chains'] }),
  });
}

// ═══════════════════════════════════════════════════════
// WORKFLOW INSTANCES
// ═══════════════════════════════════════════════════════

export function useStartWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (submissionId: string) => wfFetch(`/api/v1/workflow/submissions/${submissionId}/start`, {
      method: 'POST',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow-instances'] });
      qc.invalidateQueries({ queryKey: ['workflow-my-tasks'] });
    },
  });
}

export function useWorkflowInstances(query?: { page?: number; limit?: number; status?: string; assignee?: string }) {
  return useQuery({
    queryKey: ['workflow-instances', query],
    queryFn: () => {
      const params = new URLSearchParams();
      if (query?.page) params.set('page', String(query.page));
      if (query?.limit) params.set('limit', String(query.limit));
      if (query?.status) params.set('status', query.status);
      if (query?.assignee) params.set('assignee', query.assignee);
      return wfFetch<any>(`/api/v1/workflow/instances?${params}`);
    },
  });
}

export function useWorkflowInstance(id: string | undefined) {
  return useQuery({
    queryKey: ['workflow-instance', id],
    queryFn: () => wfFetch<any>(`/api/v1/workflow/instances/${id}`),
    enabled: !!id,
  });
}

export function useValidateInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => wfFetch(`/api/v1/workflow/instances/${id}/validate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow-instances'] });
      qc.invalidateQueries({ queryKey: ['workflow-instance'] });
      qc.invalidateQueries({ queryKey: ['workflow-my-tasks'] });
      qc.invalidateQueries({ queryKey: ['workflow-stats'] });
    },
  });
}

export function useRejectInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => wfFetch(`/api/v1/workflow/instances/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow-instances'] });
      qc.invalidateQueries({ queryKey: ['workflow-instance'] });
      qc.invalidateQueries({ queryKey: ['workflow-my-tasks'] });
      qc.invalidateQueries({ queryKey: ['workflow-stats'] });
    },
  });
}

export function useReturnInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => wfFetch(`/api/v1/workflow/instances/${id}/return`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow-instances'] });
      qc.invalidateQueries({ queryKey: ['workflow-instance'] });
      qc.invalidateQueries({ queryKey: ['workflow-my-tasks'] });
    },
  });
}

export function useReassignInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => wfFetch(`/api/v1/workflow/instances/${id}/reassign`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow-instance'] });
      qc.invalidateQueries({ queryKey: ['workflow-my-tasks'] });
    },
  });
}

export function useCommentInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => wfFetch(`/api/v1/workflow/instances/${id}/comment`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-instance'] }),
  });
}

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════

export function useMyWorkflowTasks(query?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['workflow-my-tasks', query],
    queryFn: () => {
      const params = new URLSearchParams();
      if (query?.page) params.set('page', String(query.page));
      if (query?.limit) params.set('limit', String(query.limit));
      return wfFetch<any>(`/api/v1/workflow/dashboard/my-tasks?${params}`);
    },
    refetchInterval: 30000, // Refresh every 30s
  });
}

export function useMyWorkflowSubmissions(query?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['workflow-my-submissions', query],
    queryFn: () => {
      const params = new URLSearchParams();
      if (query?.page) params.set('page', String(query.page));
      if (query?.limit) params.set('limit', String(query.limit));
      return wfFetch<any>(`/api/v1/workflow/dashboard/my-submissions?${params}`);
    },
  });
}

export function useWorkflowStats() {
  return useQuery({
    queryKey: ['workflow-stats'],
    queryFn: () => wfFetch<any>('/api/v1/workflow/dashboard/stats'),
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useWorkflowOverdue(query?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['workflow-overdue', query],
    queryFn: () => {
      const params = new URLSearchParams();
      if (query?.page) params.set('page', String(query.page));
      if (query?.limit) params.set('limit', String(query.limit));
      return wfFetch<any>(`/api/v1/workflow/dashboard/overdue?${params}`);
    },
  });
}

export function useWorkflowTimeline(id: string | undefined) {
  return useQuery({
    queryKey: ['workflow-timeline', id],
    queryFn: () => wfFetch<any>(`/api/v1/workflow/dashboard/timeline/${id}`),
    enabled: !!id,
  });
}

// ═══════════════════════════════════════════════════════
// COLLECTION CAMPAIGNS
// ═══════════════════════════════════════════════════════

export function useCollectionCampaigns(query?: { page?: number; limit?: number; status?: string; domain?: string }) {
  return useQuery({
    queryKey: ['collection-campaigns', query],
    queryFn: () => {
      const params = new URLSearchParams();
      if (query?.page) params.set('page', String(query.page));
      if (query?.limit) params.set('limit', String(query.limit));
      if (query?.status) params.set('status', query.status);
      if (query?.domain) params.set('domain', query.domain);
      return wfFetch<any>(`/api/v1/workflow/campaigns?${params}`);
    },
  });
}

export function useCollectionCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ['collection-campaign', id],
    queryFn: () => wfFetch<any>(`/api/v1/workflow/campaigns/${id}`),
    enabled: !!id,
  });
}

export function useCreateCollectionCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => wfFetch('/api/v1/workflow/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection-campaigns'] }),
  });
}

export function useUpdateCollectionCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => wfFetch(`/api/v1/workflow/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection-campaigns'] }),
  });
}

export function useActivateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => wfFetch(`/api/v1/workflow/campaigns/${id}/activate`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection-campaigns'] }),
  });
}

export function usePauseCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => wfFetch(`/api/v1/workflow/campaigns/${id}/pause`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection-campaigns'] }),
  });
}

export function useCompleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => wfFetch(`/api/v1/workflow/campaigns/${id}/complete`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection-campaigns'] }),
  });
}

export function useAddCampaignAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, ...data }: any) => wfFetch(`/api/v1/workflow/campaigns/${campaignId}/assignments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection-campaign'] }),
  });
}

export function useRemoveCampaignAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, assignId }: { campaignId: string; assignId: string }) =>
      wfFetch(`/api/v1/workflow/campaigns/${campaignId}/assignments/${assignId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection-campaign'] }),
  });
}
