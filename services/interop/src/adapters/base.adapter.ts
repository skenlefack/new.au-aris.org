export interface AdapterConfig {
  baseUrl: string;
  authType: string;
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

export interface SyncResult {
  recordsPushed: number;
  recordsPulled: number;
  errors: { message: string; record?: unknown }[];
  startedAt: string;
  completedAt: string;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
}

export interface PullResult {
  records: unknown[];
  total: number;
}

export interface PullParams {
  entityType: string;
  since?: Date;
  filters?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export abstract class BaseAdapter {
  abstract readonly system: string;
  abstract readonly displayName: string;

  abstract connect(config: AdapterConfig): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(config: AdapterConfig): Promise<ConnectionTestResult>;
  abstract push(records: unknown[], config: AdapterConfig): Promise<SyncResult>;
  abstract pull(params: PullParams, config: AdapterConfig): Promise<PullResult>;
  abstract validate(record: unknown): ValidationResult;
  abstract mapToInternal(externalRecord: unknown, entityType: string): unknown;
  abstract mapToExternal(internalRecord: unknown, entityType: string): unknown;

  protected buildAuthHeaders(config: AdapterConfig): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const creds = config.credentials;

    switch (config.authType) {
      case 'BASIC': {
        const encoded = Buffer.from(`${creds['username']}:${creds['password']}`).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
        break;
      }
      case 'OAUTH2':
        if (creds['accessToken']) {
          headers['Authorization'] = `Bearer ${creds['accessToken']}`;
        }
        break;
      case 'API_KEY':
        if (creds['headerName'] && creds['apiKey']) {
          headers[creds['headerName'] as string] = creds['apiKey'] as string;
        }
        break;
      case 'CERTIFICATE':
        // Certificate-based auth handled at transport level
        break;
    }

    return headers;
  }

  protected async httpRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: unknown,
  ): Promise<{ status: number; data: unknown }> {
    const opts: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    };

    const response = await fetch(url, opts);
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }

    return { status: response.status, data };
  }
}
