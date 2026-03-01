import {
  BaseAdapter,
  type AdapterConfig,
  type ConnectionTestResult,
  type SyncResult,
  type PullResult,
  type PullParams,
  type ValidationResult,
} from './base.adapter.js';

/**
 * WAHIS — WOAH World Animal Health Information System adapter.
 * Pushes outbreak notifications and pulls disease event reports.
 */
export class WahisAdapter extends BaseAdapter {
  readonly system = 'WAHIS';
  readonly displayName = 'WOAH WAHIS';

  async connect(_config: AdapterConfig): Promise<void> {
    // Connection pooling handled per-request
  }

  async disconnect(): Promise<void> {
    // No persistent connection
  }

  async testConnection(config: AdapterConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const headers = this.buildAuthHeaders(config);
      const { status } = await this.httpRequest(
        `${config.baseUrl}/api/v1/status`,
        'GET',
        headers,
      );
      return {
        success: status >= 200 && status < 300,
        message: status >= 200 && status < 300 ? 'WAHIS connection successful' : `HTTP ${status}`,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  async push(records: unknown[], config: AdapterConfig): Promise<SyncResult> {
    const startedAt = new Date().toISOString();
    const errors: { message: string; record?: unknown }[] = [];
    let pushed = 0;

    const headers = this.buildAuthHeaders(config);

    for (const record of records) {
      try {
        const wahisPayload = this.mapToExternal(record, 'outbreak');
        const { status } = await this.httpRequest(
          `${config.baseUrl}/api/v1/events`,
          'POST',
          headers,
          wahisPayload,
        );
        if (status >= 200 && status < 300) {
          pushed++;
        } else {
          errors.push({ message: `HTTP ${status}`, record });
        }
      } catch (err) {
        errors.push({
          message: err instanceof Error ? err.message : String(err),
          record,
        });
      }
    }

    return {
      recordsPushed: pushed,
      recordsPulled: 0,
      errors,
      startedAt,
      completedAt: new Date().toISOString(),
      status: errors.length === 0 ? 'COMPLETED' : pushed > 0 ? 'PARTIAL' : 'FAILED',
    };
  }

  async pull(params: PullParams, config: AdapterConfig): Promise<PullResult> {
    const headers = this.buildAuthHeaders(config);
    const queryParts: string[] = [];
    if (params.since) queryParts.push(`since=${params.since.toISOString()}`);
    if (params.filters?.['countryCode']) queryParts.push(`country=${params.filters['countryCode']}`);
    const qs = queryParts.length ? `?${queryParts.join('&')}` : '';

    try {
      const { status, data } = await this.httpRequest(
        `${config.baseUrl}/api/v1/events${qs}`,
        'GET',
        headers,
      );
      if (status >= 200 && status < 300 && Array.isArray(data)) {
        return { records: data.map((r) => this.mapToInternal(r, 'outbreak')), total: data.length };
      }
      return { records: [], total: 0 };
    } catch {
      return { records: [], total: 0 };
    }
  }

  validate(record: unknown): ValidationResult {
    const errors: string[] = [];
    const r = record as Record<string, unknown>;
    if (!r['diseaseId']) errors.push('diseaseId is required');
    if (!r['countryCode']) errors.push('countryCode is required');
    if (!r['reportDate']) errors.push('reportDate is required');
    return { valid: errors.length === 0, errors };
  }

  mapToInternal(externalRecord: unknown, _entityType: string): unknown {
    const ext = externalRecord as Record<string, unknown>;
    return {
      diseaseId: ext['disease_id'] ?? ext['diseaseId'],
      countryCode: ext['country'] ?? ext['countryCode'],
      reportDate: ext['report_date'] ?? ext['reportDate'],
      status: ext['status'],
      species: ext['species'],
      cases: ext['cases'],
      deaths: ext['deaths'],
      source: 'WAHIS',
    };
  }

  mapToExternal(internalRecord: unknown, _entityType: string): unknown {
    const int = internalRecord as Record<string, unknown>;
    return {
      disease_id: int['diseaseId'],
      country: int['countryCode'],
      report_date: int['reportDate'],
      status: int['status'] ?? 'CONFIRMED',
      species: int['species'],
      cases: int['cases'],
      deaths: int['deaths'],
      report_type: 'IMMEDIATE',
      source_system: 'ARIS',
    };
  }
}
