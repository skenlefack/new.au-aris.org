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
 * DHIS2 — District Health Information Software 2 adapter.
 * Pushes/pulls data value sets via the DHIS2 Web API.
 */
export class Dhis2Adapter extends BaseAdapter {
  readonly system = 'DHIS2';
  readonly displayName = 'DHIS2';

  async connect(_config: AdapterConfig): Promise<void> {}
  async disconnect(): Promise<void> {}

  async testConnection(config: AdapterConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const headers = this.buildAuthHeaders(config);
      const { status } = await this.httpRequest(
        `${config.baseUrl}/api/system/info`,
        'GET',
        headers,
      );
      return {
        success: status >= 200 && status < 300,
        message: status >= 200 && status < 300 ? 'DHIS2 connection successful' : `HTTP ${status}`,
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
    const headers = this.buildAuthHeaders(config);

    // DHIS2 expects batch data value sets
    const dataValues = records.map((r) => this.mapToExternal(r, 'dataValue'));

    try {
      const { status, data } = await this.httpRequest(
        `${config.baseUrl}/api/dataValueSets`,
        'POST',
        headers,
        { dataValues },
      );

      if (status >= 200 && status < 300) {
        const resp = data as Record<string, unknown>;
        const imported = (resp['importCount'] as Record<string, number>)?.['imported'] ?? records.length;
        return {
          recordsPushed: imported,
          recordsPulled: 0,
          errors,
          startedAt,
          completedAt: new Date().toISOString(),
          status: 'COMPLETED',
        };
      }
      errors.push({ message: `HTTP ${status}` });
    } catch (err) {
      errors.push({ message: err instanceof Error ? err.message : String(err) });
    }

    return {
      recordsPushed: 0,
      recordsPulled: 0,
      errors,
      startedAt,
      completedAt: new Date().toISOString(),
      status: 'FAILED',
    };
  }

  async pull(params: PullParams, config: AdapterConfig): Promise<PullResult> {
    const headers = this.buildAuthHeaders(config);
    const queryParts: string[] = [];
    if (params.filters?.['orgUnit']) queryParts.push(`orgUnit=${params.filters['orgUnit']}`);
    if (params.filters?.['period']) queryParts.push(`period=${params.filters['period']}`);
    if (params.filters?.['dataSet']) queryParts.push(`dataSet=${params.filters['dataSet']}`);
    if (params.since) queryParts.push(`lastUpdated=${params.since.toISOString()}`);
    const qs = queryParts.length ? `?${queryParts.join('&')}` : '';

    try {
      const { status, data } = await this.httpRequest(
        `${config.baseUrl}/api/dataValueSets${qs}`,
        'GET',
        headers,
      );
      if (status >= 200 && status < 300) {
        const resp = data as Record<string, unknown>;
        const values = (resp['dataValues'] as unknown[]) ?? [];
        return {
          records: values.map((v) => this.mapToInternal(v, 'dataValue')),
          total: values.length,
        };
      }
      return { records: [], total: 0 };
    } catch {
      return { records: [], total: 0 };
    }
  }

  validate(record: unknown): ValidationResult {
    const errors: string[] = [];
    const r = record as Record<string, unknown>;
    if (!r['dataElement']) errors.push('dataElement is required');
    if (!r['orgUnit']) errors.push('orgUnit is required');
    if (!r['period']) errors.push('period is required');
    return { valid: errors.length === 0, errors };
  }

  mapToInternal(externalRecord: unknown, _entityType: string): unknown {
    const ext = externalRecord as Record<string, unknown>;
    return {
      dataElement: ext['dataElement'],
      orgUnit: ext['orgUnit'],
      period: ext['period'],
      value: ext['value'],
      categoryOptionCombo: ext['categoryOptionCombo'],
      lastUpdated: ext['lastUpdated'],
      source: 'DHIS2',
    };
  }

  mapToExternal(internalRecord: unknown, _entityType: string): unknown {
    const int = internalRecord as Record<string, unknown>;
    return {
      dataElement: int['dataElement'] ?? int['indicatorId'],
      orgUnit: int['orgUnit'] ?? int['adminUnitId'],
      period: int['period'],
      value: String(int['value'] ?? ''),
      categoryOptionCombo: int['categoryOptionCombo'],
    };
  }
}
