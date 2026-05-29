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

const TENANT_API = process.env.NEXT_PUBLIC_TENANT_API_URL ?? '';

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
          return await handleTranslate(request, config);
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

async function handleTranslate(request: NextRequest, config: SystranConfig) {
  const body = await request.json();
  const { source, target, input } = body as {
    source: string;
    target: string;
    input: string | string[];
  };

  if (!source || !target || !input) {
    return NextResponse.json(
      { error: 'Missing required fields: source, target, input' },
      { status: 400 },
    );
  }

  const inputs = Array.isArray(input) ? input : [input];

  const systranRes = await fetch(`${config.apiUrl}/translation/text/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${config.apiKey}`,
    },
    body: JSON.stringify({ source, target, input: inputs }),
  });

  if (!systranRes.ok) {
    const errText = await systranRes.text().catch(() => '');
    return NextResponse.json(
      { error: `Systran API error (${systranRes.status})`, details: errText },
      { status: systranRes.status },
    );
  }

  const data = await systranRes.json();
  return NextResponse.json({ data });
}

/* ---------- languages ---------- */

async function handleLanguages(config: SystranConfig) {
  const res = await fetch(
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
  const res = await fetch(
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

  if (!source || !target || !input) {
    return NextResponse.json(
      { error: 'Missing required fields: source, target, input' },
      { status: 400 },
    );
  }

  const text = Array.isArray(input) ? input[0] : input;
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

    // Return in SYSTRAN-compatible format so the frontend doesn't need to change
    return NextResponse.json({
      data: {
        outputs: [{ output: translation }],
        engine: 'ollama',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'AI translation fallback failed', details: String(err) },
      { status: 502 },
    );
  }
}
