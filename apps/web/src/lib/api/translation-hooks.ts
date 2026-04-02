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

/** Translate text from one language to another via Systran proxy. */
export function useTranslateText() {
  return useMutation({
    mutationFn: (params: { source: string; target: string; input: string | string[] }) =>
      translateFetch<{ data: { outputs: { output: string }[] } }>('translate', params),
  });
}

/** Translate text to all target languages at once. */
export function useTranslateToAll() {
  return useMutation({
    mutationFn: async (params: {
      source: string;
      text: string;
      targets: string[];
    }): Promise<Record<string, string>> => {
      const results: Record<string, string> = {};
      // Run translations in parallel
      const promises = params.targets.map(async (target) => {
        const res = await translateFetch<{ data: { outputs: { output: string }[] } }>('translate', {
          source: params.source,
          target,
          input: params.text,
        });
        const output = res?.data?.outputs?.[0]?.output ?? '';
        results[target] = output;
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
