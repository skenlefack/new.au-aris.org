// React Query hooks for the AI Orchestrator service.
//
// Wraps the ai-orchestrator-service endpoints under /api/v1/ai/*.
// Uses apiClient which handles auth, tenant context, and token refresh.

import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AiHealthStatus {
  status: 'ok' | 'degraded' | 'down';
  ollama?: { connected: boolean; models?: string[] };
  ml?: { connected: boolean };
  uptime?: number;
}

export interface AiModelInfo {
  name: string;
  size?: string;
  status: 'loaded' | 'available' | 'error';
  type: 'ollama' | 'ml';
  lastUsed?: string;
}

export interface AiGenerationDraft {
  id: string;
  type: 'form' | 'campaign' | 'indicator' | 'dashboard';
  prompt: string;
  result: Record<string, unknown>;
  status: 'DRAFT' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

export interface AiUsageStats {
  totalRequests: number;
  totalTokens: number;
  avgDurationMs: number;
  byEndpoint?: Record<string, { count: number; avgMs: number }>;
  period: string;
}

export interface AiSuggestionRequest {
  prompt: string;
  context?: Record<string, unknown>;
}

export interface AiClassifyRequest {
  text: string;
  categories?: string[];
}

export interface AiSummarizeRequest {
  text: string;
  maxLength?: number;
}

export interface AiPredictRequest {
  diseaseCode: string;
  regionCode: string;
  horizon?: number;
}

export interface AiAnomalyRequest {
  datasetId: string;
  threshold?: number;
}

// ─── Health ─────────────────────────────────────────────────────────────────

export function useAiHealth() {
  return useQuery<{ data: AiHealthStatus }>({
    queryKey: ['ai', 'health'],
    queryFn: async () => {
      try {
        return await apiClient.get('/ai/health');
      } catch {
        return { data: { status: 'down', ollama: false, ml: false, models: [] } as unknown as AiHealthStatus };
      }
    },
    refetchInterval: 60_000,
    retry: 0,
    staleTime: 30_000,
  });
}

// ─── Generation (the 4 builders) ────────────────────────────────────────────

export function useSuggestForm() {
  return useMutation<{ data: Record<string, unknown> }, Error, AiSuggestionRequest>({
    mutationFn: (body) => apiClient.post('/ai/generation/suggest-form', body),
  });
}

export function useSuggestCampaign() {
  return useMutation<{ data: Record<string, unknown> }, Error, AiSuggestionRequest>({
    mutationFn: (body) => apiClient.post('/ai/generation/suggest-campaign', body),
  });
}

export function useSuggestIndicator() {
  return useMutation<{ data: Record<string, unknown> }, Error, AiSuggestionRequest>({
    mutationFn: (body) => apiClient.post('/ai/generation/suggest-indicator', body),
  });
}

export function useSuggestDashboard() {
  return useMutation<{ data: Record<string, unknown> }, Error, AiSuggestionRequest>({
    mutationFn: (body) => apiClient.post('/ai/generation/suggest-dashboard', body),
  });
}

// ─── NLP ────────────────────────────────────────────────────────────────────

export function useClassifyText() {
  return useMutation<{ data: { category: string; confidence: number } }, Error, AiClassifyRequest>({
    mutationFn: (body) => apiClient.post('/ai/nlp/classify', body),
  });
}

export function useSummarizeText() {
  return useMutation<{ data: { summary: string } }, Error, AiSummarizeRequest>({
    mutationFn: (body) => apiClient.post('/ai/nlp/summarize', body),
  });
}

// ─── Predictions ────────────────────────────────────────────────────────────

export function usePredictEpidemic() {
  return useMutation<{ data: Record<string, unknown> }, Error, AiPredictRequest>({
    mutationFn: (body) => apiClient.post('/ai/predictions/epidemic', body),
  });
}

// ─── Anomalies ──────────────────────────────────────────────────────────────

export function useDetectAnomalies() {
  return useMutation<{ data: Record<string, unknown> }, Error, AiAnomalyRequest>({
    mutationFn: (body) => apiClient.post('/ai/anomalies/detect', body),
  });
}

// ─── Usage stats ────────────────────────────────────────────────────────────

export function useAiUsageStats(period: 'hour' | 'day' | 'week' = 'day') {
  return useQuery<{ data: AiUsageStats }>({
    queryKey: ['ai', 'usage', period],
    queryFn: () => apiClient.get('/ai/admin/usage', { period }),
    staleTime: 60_000,
  });
}

export function useAiModels() {
  return useQuery<{ data: AiModelInfo[] }>({
    queryKey: ['ai', 'models'],
    queryFn: () => apiClient.get('/ai/admin/models'),
    staleTime: 60_000,
  });
}

export function useAiRecentDrafts(limit = 20) {
  return useQuery<{ data: AiGenerationDraft[] }>({
    queryKey: ['ai', 'drafts', limit],
    queryFn: () => apiClient.get('/ai/admin/drafts', { limit: String(limit) }),
    staleTime: 30_000,
  });
}

// ─── Submission Anomalies (WS2) ────────────────────────────────────────────

export interface SubmissionAnomalyRequest {
  domain?: string;
  since?: string;
  limit?: number;
  campaignId?: string;
}

export function useAnalyzeSubmissions() {
  return useMutation<{ data: Record<string, unknown> }, Error, SubmissionAnomalyRequest>({
    mutationFn: (body) => apiClient.post('/ai/anomalies/submissions', body),
  });
}

// ─── Mixed Anomaly Detection (WS5) ─────────────────────────────────────────

export interface MixedAnomalyRequest {
  data: Record<string, unknown>[];
  numericColumns?: string[];
  categoricalColumns?: string[];
  sensitivity?: number;
}

export function useDetectMixedAnomalies() {
  return useMutation<{ data: Record<string, unknown> }, Error, MixedAnomalyRequest>({
    mutationFn: (body) => apiClient.post('/ai/anomalies/detect-mixed', body),
  });
}

// ─── AI Chat (WS7) ─────────────────────────────────────────────────────────

export interface AiConversation {
  id: string;
  title: string;
  model: string;
  messageCount: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
  messages?: AiChatMessage[];
}

export interface AiChatMessage {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  fileIds: string[];
  model?: string;
  tokensUsed: number;
  durationMs: number;
  createdAt: string;
}

export interface SendMessageRequest {
  content: string;
  fileIds?: string[];
}

export function useConversations(page = 1, limit = 20) {
  return useQuery<{ data: AiConversation[]; meta: { total: number; page: number; limit: number } }>({
    queryKey: ['ai', 'conversations', page, limit],
    queryFn: () => apiClient.get('/ai/chat/conversations', { page: String(page), limit: String(limit) }),
    staleTime: 10_000,
  });
}

export function useConversation(id: string | undefined) {
  return useQuery<{ data: AiConversation }>({
    queryKey: ['ai', 'conversation', id],
    queryFn: () => apiClient.get(`/ai/chat/conversations/${id}`),
    enabled: !!id,
    staleTime: 5_000,
  });
}

export function useConversationMessages(id: string | undefined, page = 1, limit = 50) {
  return useQuery<{ data: AiChatMessage[]; meta: { total: number } }>({
    queryKey: ['ai', 'conversation', id, 'messages', page],
    queryFn: () => apiClient.get(`/ai/chat/conversations/${id}/messages`, { page: String(page), limit: String(limit) }),
    enabled: !!id,
    staleTime: 5_000,
  });
}

export function useCreateConversation() {
  return useMutation<{ data: AiConversation }, Error, { title?: string; model?: string }>({
    mutationFn: (body) => apiClient.post('/ai/chat/conversations', body),
  });
}

export function useSendMessage(conversationId: string) {
  return useMutation<{ data: { userMessage: AiChatMessage; assistantMessage: AiChatMessage } }, Error, SendMessageRequest>({
    mutationFn: (body) => apiClient.post(`/ai/chat/conversations/${conversationId}/messages`, body),
  });
}

export function useDeleteConversation() {
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiClient.delete(`/ai/chat/conversations/${id}`),
  });
}

// ─── Model Versions & A/B Testing (WS4) ────────────────────────────────────

export interface MlModelVersion {
  id: string;
  modelId: string;
  version: string;
  artifactPath?: string;
  metrics: Record<string, unknown>;
  isActive: boolean;
  trafficWeight: number;
  trainedAt?: string;
  createdAt: string;
}

export interface MlAbTest {
  id: string;
  name: string;
  modelId: string;
  versionA: MlModelVersion;
  versionB: MlModelVersion;
  trafficSplit: number;
  status: 'DRAFT' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  totalRequestsA: number;
  totalRequestsB: number;
  metricsA: Record<string, unknown>;
  metricsB: Record<string, unknown>;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export function useModelVersions(modelId: string | undefined) {
  return useQuery<{ data: MlModelVersion[] }>({
    queryKey: ['ai', 'model-versions', modelId],
    queryFn: () => apiClient.get(`/ai/models/${modelId}/versions`),
    enabled: !!modelId,
    staleTime: 30_000,
  });
}

export function useAbTests() {
  return useQuery<{ data: MlAbTest[] }>({
    queryKey: ['ai', 'ab-tests'],
    queryFn: () => apiClient.get('/ai/models/ab-tests'),
    staleTime: 30_000,
  });
}

export function usePromoteVersion() {
  return useMutation<{ data: MlModelVersion }, Error, { modelId: string; versionId: string }>({
    mutationFn: ({ modelId, versionId }) =>
      apiClient.post(`/ai/models/${modelId}/versions/${versionId}/promote`, {}),
  });
}

export function useCreateAbTest() {
  return useMutation<{ data: MlAbTest }, Error, { name: string; modelId: string; versionAId: string; versionBId: string; trafficSplit?: number }>({
    mutationFn: (body) => apiClient.post('/ai/models/ab-tests', body),
  });
}

export function useUpdateAbTest() {
  return useMutation<{ data: MlAbTest }, Error, { id: string; status?: string; trafficSplit?: number }>({
    mutationFn: ({ id, ...body }) => apiClient.patch(`/ai/models/ab-tests/${id}`, body),
  });
}

// ─── File-based Generation (WS6) ───────────────────────────────────────────

export interface SuggestWithFileRequest {
  prompt: string;
  fileId: string;
  type: 'form' | 'campaign' | 'indicator' | 'dashboard';
  context?: Record<string, unknown>;
}

export function useSuggestWithFile() {
  return useMutation<{ data: Record<string, unknown> }, Error, SuggestWithFileRequest>({
    mutationFn: (body) => apiClient.post('/ai/generation/suggest-with-file', body),
  });
}
