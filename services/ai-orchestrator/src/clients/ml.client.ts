/**
 * ml.client.ts — HTTP client for the Python ML service.
 *
 * Configurable via ML_SERVICE_URL env var.
 * Timeout: 2 min, retry: 1x on timeout errors.
 */

export interface MlPredictionParams {
  model?: string;
  features: Record<string, unknown>;
  horizon?: number;
}

export interface MlPredictionResult {
  predictions: Record<string, unknown>[];
  model: string;
  durationMs: number;
  confidence?: number;
}

export interface MlAnomalyParams {
  data: Record<string, unknown>[];
  method?: 'isolation_forest' | 'dbscan' | 'zscore';
  threshold?: number;
}

export interface MlAnomalyResult {
  anomalies: Array<{ index: number; score: number; isAnomaly: boolean }>;
  totalChecked: number;
  anomalyCount: number;
  durationMs: number;
}

export interface MlSubmissionParams {
  submissions: Array<{ id: string; data: Record<string, unknown> }>;
  sensitivity?: number;
}

export interface MlSubmissionAnomalyItem {
  submission_id: string;
  is_anomaly: boolean;
  anomaly_score: number;
  anomalous_fields: Array<{ field: string; value: number; z_score: number }>;
}

export interface MlSubmissionResult {
  results: MlSubmissionAnomalyItem[];
  total_submissions: number;
  anomaly_count: number;
  durationMs: number;
}

export interface MlClusterParams {
  points: Array<{ lat: number; lng: number; weight?: number; metadata?: Record<string, unknown> }>;
  algorithm?: 'kmeans' | 'dbscan' | 'hdbscan';
  numClusters?: number;
  eps?: number;
}

export interface MlClusterResult {
  clusters: Array<{
    id: number;
    centroid: { lat: number; lng: number };
    size: number;
    points: number[];
  }>;
  durationMs: number;
}

export interface MlClassifyParams {
  text: string;
  categories: string[];
  model?: string;
}

export interface MlClassifyResult {
  label: string;
  confidence: number;
  scores: Record<string, number>;
  durationMs: number;
}

export interface MlExtractParams {
  text: string;
  entityTypes?: string[];
}

export interface MlExtractResult {
  entities: Array<{ text: string; type: string; start: number; end: number; confidence: number }>;
  durationMs: number;
}

export interface MlModelInfo {
  name: string;
  type: string;
  version: string;
  status: 'loaded' | 'available' | 'error';
}

const DEFAULT_URL = 'http://10.202.101.142:8000';
const REQUEST_TIMEOUT_MS = 2 * 60 * 1000; // 2 min
const HEALTH_TIMEOUT_MS = 5_000;
const RETRY_DELAY_MS = 5_000;

export class MlClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env['ML_SERVICE_URL'] || DEFAULT_URL;
  }

  // ── Predictions ──

  async predictEpidemic(params: MlPredictionParams): Promise<MlPredictionResult> {
    return this.post<MlPredictionResult>('/api/v1/predict/epidemic', params);
  }

  async predictProduction(params: MlPredictionParams): Promise<MlPredictionResult> {
    return this.post<MlPredictionResult>('/api/v1/predict/production', params);
  }

  // ── Anomalies ──

  async detectAnomalies(params: MlAnomalyParams): Promise<MlAnomalyResult> {
    return this.post<MlAnomalyResult>('/api/v1/anomalies/detect', params);
  }

  async analyzeSubmissions(params: MlSubmissionParams): Promise<MlSubmissionResult> {
    return this.post<MlSubmissionResult>('/api/v1/anomalies/submissions', params);
  }

  // ── Spatial ──

  async clusterSpatial(params: MlClusterParams): Promise<MlClusterResult> {
    return this.post<MlClusterResult>('/api/v1/spatial/cluster', params);
  }

  // ── NLP (ML-based, distinct from Ollama LLM) ──

  async classifyText(params: MlClassifyParams): Promise<MlClassifyResult> {
    return this.post<MlClassifyResult>('/api/v1/nlp/classify', params);
  }

  async extractEntities(params: MlExtractParams): Promise<MlExtractResult> {
    return this.post<MlExtractResult>('/api/v1/nlp/extract', params);
  }

  // ── Models ──

  async listModels(): Promise<MlModelInfo[]> {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/api/v1/models`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        HEALTH_TIMEOUT_MS,
      );
      if (!response.ok) return [];
      const data = (await response.json()) as { models?: MlModelInfo[] };
      return data.models ?? [];
    } catch {
      return [];
    }
  }

  // ── Health ──

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/health`,
        { method: 'GET' },
        HEALTH_TIMEOUT_MS,
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  // ── Internal ──

  private async post<T>(path: string, body: unknown): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt === 1) {
        await sleep(RETRY_DELAY_MS);
      }

      const start = Date.now();
      try {
        const response = await fetchWithTimeout(
          `${this.baseUrl}${path}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
          REQUEST_TIMEOUT_MS,
        );

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`ML service returned ${response.status}: ${text}`);
        }

        const data = (await response.json()) as T & { durationMs?: number };
        // Inject client-side timing if not provided by the service
        if (!data.durationMs) {
          (data as Record<string, unknown>)['durationMs'] = Date.now() - start;
        }
        return data;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt === 0 && isTimeoutError(lastError)) {
          continue;
        }
        break;
      }
    }

    throw new Error(
      `ML service unavailable at ${this.baseUrl}: ${lastError?.message ?? 'unknown error'}`,
    );
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
