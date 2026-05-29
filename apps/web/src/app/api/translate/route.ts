import { NextRequest, NextResponse } from 'next/server';

/**
 * Systran Translation API Proxy
 *
 * Proxies translation requests to the Systran server so the API key
 * never leaves the server.  Configuration is read from:
 *   1. System settings stored in the tenant service  (POST body can carry overrides)
 *   2. Environment variables as fallback
 *
 * Endpoints exposed:
 *   POST /api/translate          — translate text
 *   POST /api/translate?action=languages  — list supported language pairs
 *   POST /api/translate?action=status     — test connection / status
 */

/** Fetch wrapper that disables TLS verification for internal SYSTRAN servers */
async function systranFetch(url: string, init?: RequestInit): Promise<Response> {
  // For internal IPs with self-signed certs, disable TLS verification
  const isInternal = url.includes('10.') || url.includes('192.168.') || url.includes('172.');
  if (isInternal) {
    const origValue = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    try {
      return await fetch(url, init);
    } finally {
      if (origValue !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = origValue;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
    }
  }
  return fetch(url, init);
}

const TENANT_API = process.env.INTERNAL_TENANT_URL
  ?? process.env.NEXT_PUBLIC_TENANT_API_URL
  ?? '';

/* ---------- helpers ---------- */

interface SystranConfig {
  apiUrl: string;
  apiKey: string;
}

/** Resolve Systran config: first try system settings, fallback to env vars. */
async function getSystranConfig(authHeader: string | null): Promise<SystranConfig> {
  // Try reading from system settings via the tenant service
  if (TENANT_API && authHeader) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      };
      const res = await fetch(`${TENANT_API}/api/v1/settings/config/systran`, { headers });
      if (res.ok) {
        const body = await res.json();
        const configs: { key: string; value: unknown }[] = body?.data ?? [];
        const url = configs.find((c) => c.key === 'systran.apiUrl')?.value as string | undefined;
        const key = configs.find((c) => c.key === 'systran.apiKey')?.value as string | undefined;
        if (url && key) return { apiUrl: url.replace(/\/+$/, ''), apiKey: key };
      }
    } catch {
      // fall through to env vars
    }
  }

  // Fallback to environment variables
  const apiUrl = process.env.SYSTRAN_API_URL ?? '';
  const apiKey = process.env.SYSTRAN_API_KEY ?? '';
  return { apiUrl: apiUrl.replace(/\/+$/, ''), apiKey };
}

/* ---------- POST handler ---------- */

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  const action = request.nextUrl.searchParams.get('action') ?? 'translate';
  const config = await getSystranConfig(authHeader);

  // If SYSTRAN is configured, use it
  if (config.apiUrl && config.apiKey) {
    try {
      switch (action) {
        case 'translate':
          return await handleTranslate(request, config, authHeader);
        case 'languages':
          return await handleLanguages(config);
        case 'status':
          return await handleStatus(config);
        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    } catch (err) {
      // If SYSTRAN fails, fall through to Ollama fallback for translate action
      if (action === 'translate') {
        console.warn('SYSTRAN failed, falling back to Ollama:', String(err));
        return await handleOllamaFallback(request, authHeader);
      }
      return NextResponse.json(
        { error: 'Translation proxy error', details: String(err) },
        { status: 502 },
      );
    }
  }

  // SYSTRAN not configured — use Ollama AI fallback for translate
  if (action === 'translate') {
    return await handleOllamaFallback(request, authHeader);
  }

  // For non-translate actions without SYSTRAN, return appropriate response
  if (action === 'status') {
    return NextResponse.json({
      data: { connected: false, status: 0, apiUrl: '', fallback: 'ollama' },
    });
  }

  if (action === 'languages') {
    // Return common language pairs supported by Ollama
    return NextResponse.json({
      data: {
        languagePairs: [
          { source: 'en', target: 'fr' }, { source: 'en', target: 'pt' },
          { source: 'en', target: 'ar' }, { source: 'en', target: 'es' },
          { source: 'fr', target: 'en' }, { source: 'fr', target: 'pt' },
          { source: 'fr', target: 'ar' }, { source: 'fr', target: 'es' },
          { source: 'pt', target: 'en' }, { source: 'pt', target: 'fr' },
          { source: 'ar', target: 'en' }, { source: 'ar', target: 'fr' },
          { source: 'es', target: 'en' }, { source: 'es', target: 'fr' },
        ],
        engine: 'ollama',
      },
    });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

/* ---------- translate ---------- */

/**
 * SYSTRAN supported direct pairs (discovered from /supportedLanguages):
 *   en↔fr, en↔ar, en↔pt, fr↔en, ar↔en, pt↔en
 * For unsupported pairs (e.g. fr→pt), we pivot through English:
 *   fr → en → pt
 */
const DIRECT_PAIRS = new Set([
  'en-fr', 'en-ar', 'en-pt',
  'fr-en', 'ar-en', 'pt-en',
]);

/** Languages that SYSTRAN can handle (source or target via pivot) */
const SUPPORTED_LANGS = new Set(['en', 'fr', 'ar', 'pt']);

/**
 * Simple language detection heuristic based on Unicode character ranges and common words.
 * Returns detected language code or the provided source as fallback.
 */
function detectLanguage(text: string, declaredSource: string): string {
  const trimmed = text.trim();
  if (!trimmed) return declaredSource;

  // Arabic: contains Arabic Unicode block characters
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(trimmed)) return 'ar';

  // Portuguese indicators: common Portuguese words/patterns not in French/English
  const ptWords = /\b(relatório|saúde|são|não|também|através|número|informação|produção|vacinação|período)\b/i;
  if (ptWords.test(trimmed)) return 'pt';

  // French indicators: common French words/accents
  const frWords = /\b(rapport|santé|animale|maladie|foyer|période|déclaration|nombre|données|élevage|résultat|enquête|signalement|également|contrôle|mesure|vétérinaire|abattoir|vaccination|département|région)\b/i;
  const frAccents = /[àâçéèêëîïôùûüÿœæ]/i;
  if (frWords.test(trimmed) || (frAccents.test(trimmed) && !/\b(the|and|or|is|are|was|for|with)\b/i.test(trimmed))) return 'fr';

  // Spanish indicators
  const esWords = /\b(informe|enfermedad|vacunación|número|período|también|producción|salud|animal|datos|resultado)\b/i;
  if (esWords.test(trimmed)) return 'es';

  // Default: trust the declared source
  return declaredSource;
}

function hasDirectPair(source: string, target: string): boolean {
  return DIRECT_PAIRS.has(`${source}-${target}`);
}

async function systranTranslateOnce(
  config: SystranConfig,
  source: string,
  target: string,
  inputs: string[],
): Promise<string[]> {
  const res = await systranFetch(`${config.apiUrl}/translation/text/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${config.apiKey}`,
    },
    body: JSON.stringify({ source, target, input: inputs }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Systran ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.outputs || []).map((o: { output: string }) => o.output);
}

async function handleTranslate(request: NextRequest, config: SystranConfig, authHeader: string | null = null) {
  const body = await request.json();
  const { source, target, input } = body as {
    source: string;
    target: string;
    input: string | string[];
  };

  if (!source || !target) {
    return NextResponse.json(
      { error: 'Missing required fields: source, target' },
      { status: 400 },
    );
  }

  // Handle missing or empty input gracefully
  if (!input) {
    return NextResponse.json({ data: { outputs: [{ output: '' }] } });
  }

  const inputs = Array.isArray(input) ? input : [input];

  // Skip empty inputs — return them as-is
  if (inputs.every((t) => !t.trim())) {
    return NextResponse.json({
      data: { outputs: inputs.map((t) => ({ output: t })) },
    });
  }

  try {
    // Auto-detect actual language of the text (user may have declared wrong source)
    const effectiveSource = detectLanguage(inputs[0], source);

    let outputs: string[];

    if (effectiveSource === target) {
      // Same language — return as-is
      outputs = inputs;
    } else if (!SUPPORTED_LANGS.has(effectiveSource) || !SUPPORTED_LANGS.has(target)) {
      // Unsupported language (e.g. Spanish) — fall back to Ollama
      return await handleOllamaTranslate(effectiveSource, target, inputs[0], authHeader);
    } else if (hasDirectPair(effectiveSource, target)) {
      // Direct translation available
      outputs = await systranTranslateOnce(config, effectiveSource, target, inputs);
    } else {
      // Pivot through English: source → en → target
      const toEnglish = effectiveSource === 'en'
        ? inputs
        : await systranTranslateOnce(config, effectiveSource, 'en', inputs);
      outputs = target === 'en'
        ? toEnglish
        : await systranTranslateOnce(config, 'en', target, toEnglish);
    }

    return NextResponse.json({
      data: { outputs: outputs.map((o) => ({ output: o })) },
    });
  } catch (err) {
    // If SYSTRAN fails, try Ollama as last resort
    try {
      return await handleOllamaTranslate(source, target, inputs[0], authHeader);
    } catch {
      return NextResponse.json(
        { error: `Systran API error`, details: String(err).slice(0, 300) },
        { status: 502 },
      );
    }
  }
}

/* ---------- languages ---------- */

async function handleLanguages(config: SystranConfig) {
  const res = await systranFetch(
    `${config.apiUrl}/translation/supportedLanguages?key=${encodeURIComponent(config.apiKey)}`,
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return NextResponse.json(
      { error: `Systran API error (${res.status})`, details: errText },
      { status: res.status },
    );
  }

  const data = await res.json();
  return NextResponse.json({ data });
}

/* ---------- status ---------- */

async function handleStatus(config: SystranConfig) {
  // Quick health check — try fetching supported languages
  const res = await systranFetch(
    `${config.apiUrl}/translation/supportedLanguages?key=${encodeURIComponent(config.apiKey)}`,
  );

  return NextResponse.json({
    data: {
      connected: res.ok,
      status: res.status,
      apiUrl: config.apiUrl,
    },
  });
}

/* ---------- Ollama AI fallback ---------- */

const AI_ORCHESTRATOR_URL = process.env.AI_ORCHESTRATOR_URL
  ?? process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')
  ?? 'http://localhost:4000';

const LANG_NAMES: Record<string, string> = {
  en: 'English', fr: 'French', pt: 'Portuguese', ar: 'Arabic', es: 'Spanish',
};

/** Translate a single text using Ollama AI — called with pre-parsed params */
async function handleOllamaTranslate(
  source: string,
  target: string,
  text: string,
  authHeader: string | null,
): Promise<NextResponse> {
  if (!text?.trim()) {
    return NextResponse.json({ data: { outputs: [{ output: '' }] } });
  }

  const sourceLang = LANG_NAMES[source] || source;
  const targetLang = LANG_NAMES[target] || target;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    const res = await fetch(`${AI_ORCHESTRATOR_URL}/api/v1/ai/nlp/translate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, sourceLang, targetLang }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `AI translation failed (${res.status})`, details: errText },
        { status: res.status },
      );
    }

    const data = await res.json();
    const translation = data?.data?.translation ?? text;

    return NextResponse.json({
      data: { outputs: [{ output: translation }], engine: 'ollama' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'AI translation fallback failed', details: String(err) },
      { status: 502 },
    );
  }
}

/** Ollama fallback — called from the POST handler when request body is not yet consumed */
async function handleOllamaFallback(
  request: NextRequest,
  authHeader: string | null,
) {
  const body = await request.json();
  const { source, target, input } = body as {
    source: string;
    target: string;
    input: string | string[];
  };

  const text = Array.isArray(input) ? input[0] : (input || '');
  return handleOllamaTranslate(source || 'en', target || 'fr', text, authHeader);
}
