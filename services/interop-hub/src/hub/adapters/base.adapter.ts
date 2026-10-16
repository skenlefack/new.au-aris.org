// ═══════════════════════════════════════════════════════════════════
//  ARIS Interoperability Hub v3 — Base Adapter
//  All system-specific adapters extend this abstract class.
// ═══════════════════════════════════════════════════════════════════

export interface AdapterConfig {
  baseUrl?: string;
  authType: string;
  credentials: Record<string, unknown>;
  headers?: Record<string, string>;
  config?: Record<string, unknown>;
}

export interface FormatBuildResult {
  /** Format identifier, e.g. 'WOAH_XML' */
  format: string;
  /** Formatted output (string for text formats, Buffer for binary) */
  data: string | Buffer;
  /** MIME type */
  contentType: string;
  /** Suggested filename for download/storage */
  filename: string;
  /** Number of records included */
  recordCount: number;
  /** Additional metadata about the build */
  metadata?: Record<string, unknown>;
}

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  deliveredAt: Date;
  error?: string;
}

export interface PullResult {
  records: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
  hasMore?: boolean;
  cursor?: string;
}

export interface HealthCheckResult {
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'TIMEOUT';
  responseTimeMs: number;
  statusCode?: number;
  message?: string;
}

export abstract class BaseAdapter {
  abstract readonly systemType: string;
  abstract readonly displayName: string;

  /**
   * Build an export-ready payload from ARIS records.
   * Called during the FORMAT_BUILD pipeline step.
   */
  abstract formatBuild(
    records: Record<string, unknown>[],
    config: AdapterConfig & Record<string, unknown>,
  ): Promise<FormatBuildResult>;

  /**
   * Deliver formatted data to the external system.
   * Called during the DELIVER pipeline step.
   */
  abstract deliver(
    formatted: FormatBuildResult,
    config: AdapterConfig,
  ): Promise<DeliveryResult>;

  /**
   * Pull records from the external system (INBOUND).
   */
  abstract pull(
    config: AdapterConfig,
    params: Record<string, unknown>,
  ): Promise<PullResult>;

  /**
   * Check connectivity / health of the external system.
   */
  abstract healthCheck(config: AdapterConfig): Promise<HealthCheckResult>;

  // ─── Shared HTTP helper ──────────────────────────────────────────

  protected async httpRequest(
    url: string,
    options: RequestInit & { timeout?: number },
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = options.timeout ?? 30_000;
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Auth header builder ─────────────────────────────────────────

  protected buildAuthHeaders(config: AdapterConfig): Record<string, string> {
    const headers: Record<string, string> = { ...(config.headers ?? {}) };
    const creds = config.credentials ?? {};

    switch (config.authType) {
      case 'BASIC': {
        const username = creds.username as string | undefined;
        const password = creds.password as string | undefined;
        if (username && password) {
          headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
        }
        break;
      }
      case 'BEARER_TOKEN': {
        const token = creds.token as string | undefined;
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        break;
      }
      case 'API_KEY': {
        const headerName = (creds.header_name as string) ?? 'X-API-Key';
        const apiKey = creds.api_key as string | undefined;
        if (apiKey) {
          headers[headerName] = apiKey;
        }
        break;
      }
      case 'OAUTH2': {
        // OAuth2: expect a pre-fetched access_token in credentials
        const accessToken = creds.access_token as string | undefined;
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }
        break;
      }
      // NONE, CERTIFICATE, HMAC — no headers to add here
      default:
        break;
    }

    return headers;
  }

  // ─── Safe date formatter ─────────────────────────────────────────

  protected formatDate(value: unknown): string {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(String(value));
    return isNaN(d.getTime()) ? String(value) : d.toISOString().split('T')[0]!;
  }

  protected formatDateTime(value: unknown): string {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(String(value));
    return isNaN(d.getTime()) ? String(value) : d.toISOString();
  }

  // ─── CSV helper ──────────────────────────────────────────────────

  protected buildCsv(headers: string[], rows: string[][]): string {
    const escape = (v: string) => {
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    };
    const lines = [headers.map(escape).join(',')];
    for (const row of rows) {
      lines.push(row.map(v => escape(String(v ?? ''))).join(','));
    }
    return lines.join('\n');
  }
}
