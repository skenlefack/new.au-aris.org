// ═══════════════════════════════════════════════════════════════════
//  Generic REST Adapter — Configurable adapter for any REST API
//  Supports JSON and CSV formats with configurable auth and endpoints.
// ═══════════════════════════════════════════════════════════════════

import {
  BaseAdapter,
  type AdapterConfig,
  type FormatBuildResult,
  type DeliveryResult,
  type PullResult,
  type HealthCheckResult,
} from './base.adapter';

export class GenericRestAdapter extends BaseAdapter {
  readonly systemType = 'REST_API';
  readonly displayName = 'Generic REST API';

  // ─── FORMAT BUILD ────────────────────────────────────────────────

  async formatBuild(
    records: Record<string, unknown>[],
    config: AdapterConfig & Record<string, unknown>,
  ): Promise<FormatBuildResult> {
    const format = (config.format as string) ?? 'JSON_GENERIC';
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');

    if (format === 'CSV_GENERIC') {
      return this.buildGenericCsv(records, config, timestamp);
    }

    // Default: JSON
    const wrapperField = config.wrapper_field as string | undefined;
    const includeMetadata = config.include_metadata !== false;

    let payload: unknown;
    if (wrapperField) {
      payload = {
        ...(includeMetadata
          ? {
              metadata: {
                source: 'ARIS',
                generated_at: now.toISOString(),
                record_count: records.length,
              },
            }
          : {}),
        [wrapperField]: records,
      };
    } else if (includeMetadata) {
      payload = {
        metadata: {
          source: 'ARIS',
          generated_at: now.toISOString(),
          record_count: records.length,
        },
        data: records,
      };
    } else {
      payload = records;
    }

    const data = JSON.stringify(payload, null, 2);
    return {
      format: 'JSON_GENERIC',
      data,
      contentType: 'application/json',
      filename: `export-${timestamp}.json`,
      recordCount: records.length,
    };
  }

  private buildGenericCsv(
    records: Record<string, unknown>[],
    config: Record<string, unknown>,
    timestamp: string,
  ): FormatBuildResult {
    if (records.length === 0) {
      return {
        format: 'CSV_GENERIC',
        data: '',
        contentType: 'text/csv',
        filename: `export-${timestamp}.csv`,
        recordCount: 0,
      };
    }

    // Use configured columns or extract from first record
    const columns = (config.csv_columns as string[]) ??
      Object.keys(records[0]!).filter(k => {
        const val = records[0]![k];
        return val === null || val === undefined || typeof val !== 'object';
      });

    const rows = records.map(record =>
      columns.map(col => String(record[col] ?? '')),
    );

    return {
      format: 'CSV_GENERIC',
      data: this.buildCsv(columns, rows),
      contentType: 'text/csv',
      filename: `export-${timestamp}.csv`,
      recordCount: records.length,
    };
  }

  // ─── DELIVER ─────────────────────────────────────────────────────

  async deliver(
    formatted: FormatBuildResult,
    config: AdapterConfig,
  ): Promise<DeliveryResult> {
    const url = config.baseUrl;
    if (!url) {
      return {
        success: false,
        deliveredAt: new Date(),
        error: 'No delivery URL configured',
      };
    }

    const method = (config.config?.method as string) ?? 'POST';

    try {
      const headers = this.buildAuthHeaders(config);
      headers['Content-Type'] = formatted.contentType;
      headers['User-Agent'] = 'ARIS-InteropHub/1.0';

      const response = await this.httpRequest(url, {
        method,
        headers,
        body: typeof formatted.data === 'string' ? formatted.data : formatted.data.toString('utf-8'),
        timeout: (config.config?.timeout as number) ?? 30_000,
      });

      const responseBody = await response.text();
      return {
        success: response.ok,
        statusCode: response.status,
        responseBody: responseBody.slice(0, 2000),
        deliveredAt: new Date(),
        error: response.ok ? undefined : `Remote API returned HTTP ${response.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        deliveredAt: new Date(),
        error: `REST delivery failed: ${err.message}`,
      };
    }
  }

  // ─── PULL ────────────────────────────────────────────────────────

  async pull(
    config: AdapterConfig,
    params: Record<string, unknown>,
  ): Promise<PullResult> {
    const baseUrl = config.baseUrl;
    if (!baseUrl) {
      return { records: [], metadata: { error: 'No base URL configured' } };
    }

    try {
      const path = (params.path as string) ?? '';
      const queryParams = (params.query ?? {}) as Record<string, string>;
      const queryParts = Object.entries(queryParams).map(
        ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
      );
      const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
      const url = `${baseUrl.replace(/\/+$/, '')}${path}${queryString}`;

      const headers = this.buildAuthHeaders(config);
      headers['Accept'] = 'application/json';

      const response = await this.httpRequest(url, {
        method: 'GET',
        headers,
        timeout: (config.config?.timeout as number) ?? 30_000,
      });

      if (!response.ok) {
        return { records: [], metadata: { error: `API returned HTTP ${response.status}` } };
      }

      const body = await response.json() as Record<string, unknown>;

      // Try common response shapes
      const recordsPath = params.records_path as string | undefined;
      let records: Record<string, unknown>[];

      if (recordsPath) {
        let current: unknown = body;
        for (const segment of recordsPath.split('.')) {
          current = (current as Record<string, unknown>)?.[segment];
        }
        records = Array.isArray(current) ? current : [];
      } else if (Array.isArray(body)) {
        records = body;
      } else if (Array.isArray(body.data)) {
        records = body.data;
      } else if (Array.isArray(body.results)) {
        records = body.results;
      } else if (Array.isArray(body.items)) {
        records = body.items;
      } else {
        records = [body];
      }

      const hasMore = Boolean(body.has_more ?? body.hasMore ?? body.next);
      const cursor = (body.next_cursor ?? body.cursor ?? body.next) as string | undefined;

      return { records, hasMore, cursor };
    } catch (err: any) {
      return { records: [], metadata: { error: `REST pull failed: ${err.message}` } };
    }
  }

  // ─── HEALTH CHECK ────────────────────────────────────────────────

  async healthCheck(config: AdapterConfig): Promise<HealthCheckResult> {
    const url = config.baseUrl;
    if (!url) {
      return { status: 'DOWN', responseTimeMs: 0, message: 'No base URL configured' };
    }

    const start = Date.now();
    const healthPath = (config.config?.health_path as string) ?? '';
    const healthUrl = `${url.replace(/\/+$/, '')}${healthPath}`;

    try {
      const headers = this.buildAuthHeaders(config);
      const response = await this.httpRequest(healthUrl, {
        method: 'HEAD',
        headers,
        timeout: 10_000,
      });

      return {
        status: response.ok ? 'UP' : 'DEGRADED',
        responseTimeMs: Date.now() - start,
        statusCode: response.status,
        message: response.ok ? 'API reachable' : `HTTP ${response.status}`,
      };
    } catch (err: any) {
      const elapsed = Date.now() - start;
      return {
        status: elapsed >= 10_000 ? 'TIMEOUT' : 'DOWN',
        responseTimeMs: elapsed,
        message: `Health check failed: ${err.message}`,
      };
    }
  }
}
