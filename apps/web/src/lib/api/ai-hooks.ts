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
    queryFn: () => apiClient.get('/ai/health'),
    refetchInterval: 30_000, // poll every 30s
    retry: 1,
    staleTime: 10_000,
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
