'use client';

import { useQuery, useMutation } from '@tanstack/react-query';

/* ── Systran API proxy (Next.js route) ── */

const TRANSLATE_API = '/api/translate';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window === 'undefined') return headers;
  try {
    const raw = localStorage.getItem('aris-auth');
    if (raw) {
      const token = JSON.parse(raw)?.state?.accessToken;
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
  } catch { /* ignore */ }
  return headers;
}

async function translateFetch<T = any>(action: string, body?: unknown): Promise<T> {
  const res = await fetch(`${TRANSLATE_API}?action=${action}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: body ? JSON.stringify(body) : '{}',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Translation API error (${res.status})`);
  }
  return res.json();
}

/* ── Hooks ── */

/**
 * Translate text from one language to another.
 * Tries SYSTRAN first, falls back to Ollama AI if SYSTRAN is unavailable.
 */
export function useTranslateText() {
  return useMutation({
    mutationFn: async (params: { source: string; target: string; input: string | string[] }) => {
      try {
        return await translateFetch<{ data: { outputs: { output: string }[] } }>('translate', params);
      } catch (err) {
        // Fallback to Ollama if SYSTRAN not configured
        const isSystranDown = String(err).includes('503') || String(err).includes('not configured');
        if (!isSystranDown) throw err;

        const langNames: Record<string, string> = { en: 'English', fr: 'French', pt: 'Portuguese', ar: 'Arabic', es: 'Spanish' };
        const text = Array.isArray(params.input) ? params.input[0] : params.input;
        const res = await fetch('/api/v1/ai/nlp/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            text,
            sourceLang: langNames[params.source] || params.source,
            targetLang: langNames[params.target] || params.target,
          }),
        });
        if (!res.ok) throw new Error(`AI translation failed (${res.status})`);
        const data = await res.json();
        return { data: { outputs: [{ output: data?.data?.translation ?? '' }] } };
      }
    },
  });
}

/**
 * Translate text to all target languages at once via the /api/translate proxy.
 * The proxy handles: SYSTRAN (direct + pivot), auto-detect language, Ollama fallback.
 * Each target language is translated independently — one failure doesn't block others.
 */
export function useTranslateToAll() {
  return useMutation({
    mutationFn: async (params: {
      source: string;
      text: string;
      targets: string[];
    }): Promise<Record<string, string>> => {
      const results: Record<string, string> = {};

      const promises = params.targets.map(async (target) => {
        try {
          const res = await translateFetch<{ data: { outputs: { output: string }[] } }>('translate', {
            source: params.source,
            target,
            input: params.text,
          });
          results[target] = res?.data?.outputs?.[0]?.output ?? '';
        } catch {
          // Skip failed language — don't block others
        }
      });
      await Promise.all(promises);
      return results;
    },
  });
}

/** Test Systran connection status. */
export function useSystranStatus() {
  return useQuery({
    queryKey: ['systran', 'status'],
    queryFn: () => translateFetch<{ data: { connected: boolean; status: number; apiUrl: string } }>('status'),
    staleTime: 30_000,
    retry: false,
  });
}

/** Fetch supported language pairs from Systran. */
export function useSystranLanguages() {
  return useQuery({
    queryKey: ['systran', 'languages'],
    queryFn: () => translateFetch<{ data: { languagePairs: { source: string; target: string }[] } }>('languages'),
    staleTime: 60 * 60_000,
    retry: false,
  });
}
