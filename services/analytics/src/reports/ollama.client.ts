/**
 * ollama.client.ts — HTTP client for Ollama LLM inference.
 *
 * Configurable via OLLAMA_URL env var. Graceful fallback when unavailable.
 * Default model: qwen2.5:32b
 */

export interface OllamaGenerateParams {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface OllamaGenerateResult {
  output: string;
  tokensInput: number;
  tokensOutput: number;
  durationMs: number;
}

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

const DEFAULT_URL = 'http://10.202.101.188:11434';
const GENERATE_TIMEOUT_MS = 5 * 60 * 1000; // 5 min
const HEALTH_TIMEOUT_MS = 3_000;
const RETRY_DELAY_MS = 10_000;

export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env['OLLAMA_URL'] || DEFAULT_URL;
  }

  /**
   * Generate text from Ollama.
   * Retries once after 10 s on timeout. Throws with clear message if unavailable.
   */
  async generate(params: OllamaGenerateParams): Promise<OllamaGenerateResult> {
    const body = {
      model: params.model,
      prompt: params.prompt,
      system: params.system,
      stream: false,
      options: {
        temperature: params.temperature ?? 0.3,
        num_predict: params.maxTokens ?? 4096,
      },
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt === 1) {
        await sleep(RETRY_DELAY_MS);
      }

      const start = Date.now();
      try {
        const response = await fetchWithTimeout(
          `${this.baseUrl}/api/generate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
          GENERATE_TIMEOUT_MS,
        );

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`Ollama returned ${response.status}: ${text}`);
        }

        const data = await response.json() as Record<string, unknown>;
        const durationMs = Date.now() - start;

        return {
          output: (data['response'] as string) ?? '',
          tokensInput: (data['prompt_eval_count'] as number) ?? 0,
          tokensOutput: (data['eval_count'] as number) ?? 0,
          durationMs,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Only retry on timeout-like errors
        if (attempt === 0 && isTimeoutError(lastError)) {
          continue;
        }
        break;
      }
    }

    throw new Error(
      `Ollama unavailable at ${this.baseUrl}: ${lastError?.message ?? 'unknown error'}`,
    );
  }

  /**
   * Quick health check — returns true if Ollama responds within 3 s.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/api/tags`,
        { method: 'GET' },
        HEALTH_TIMEOUT_MS,
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models on the Ollama instance.
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/api/tags`,
        { method: 'GET' },
        HEALTH_TIMEOUT_MS,
      );
      if (!response.ok) return [];
      const data = await response.json() as { models?: OllamaModel[] };
      return (data.models ?? []).map((m) => m.name);
    } catch {
      return [];
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// ── Helpers ──

function isTimeoutError(err: Error): boolean {
  return (
    err.name === 'AbortError' ||
    err.message.includes('timeout') ||
    err.message.includes('ETIMEDOUT') ||
    err.message.includes('ECONNREFUSED')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
