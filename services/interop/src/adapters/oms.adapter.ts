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
 * OMS/WHO — World Health Organization Global Health Observatory adapter.
 */
export class OmsAdapter extends BaseAdapter {
  readonly system = 'OMS';
  readonly displayName = 'WHO / OMS';

  async connect(_config: AdapterConfig): Promise<void> {}
  async disconnect(): Promise<void> {}

  async testConnection(config: AdapterConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const headers = this.buildAuthHeaders(config);
      const { status } = await this.httpRequest(
        `${config.baseUrl}/api/indicators`,
        'GET',
        headers,
      );
      return {
        success: status >= 200 && status < 300,
        message: status >= 200 && status < 300 ? 'WHO GHO API reachable' : `HTTP ${status}`,
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
    let pushed = 0;

    for (const record of records) {
      try {
        const payload = this.mapToExternal(record, 'indicator');
        const { status } = await this.httpRequest(
          `${config.baseUrl}/api/data`,
          'POST',
          headers,
          payload,
        );
        if (status >= 200 && status < 300) pushed++;
        else errors.push({ message: `HTTP ${status}`, record });
      } catch (err) {
        errors.push({ message: err instanceof Error ? err.message : String(err), record });
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
    if (params.filters?.['indicator']) queryParts.push(`indicator=${params.filters['indicator']}`);
    if (params.filters?.['country']) queryParts.push(`country=${params.filters['country']}`);
    if (params.filters?.['year']) queryParts.push(`year=${params.filters['year']}`);
    const qs = queryParts.length ? `?${queryParts.join('&')}` : '';

    try {
      const { status, data } = await this.httpRequest(
        `${config.baseUrl}/api/data${qs}`,
        'GET',
        headers,
      );
      if (status >= 200 && status < 300) {
        const resp = data as Record<string, unknown>;
        const values = (resp['value'] as unknown[]) ?? [];
        return { records: values.map((v) => this.mapToInternal(v, 'indicator')), total: values.length };
      }
      return { records: [], total: 0 };
    } catch {
      return { records: [], total: 0 };
    }
  }

  validate(record: unknown): ValidationResult {
    const errors: string[] = [];
    const r = record as Record<string, unknown>;
    if (!r['indicatorCode']) errors.push('indicatorCode is required');
    if (!r['countryCode']) errors.push('countryCode is required');
    return { valid: errors.length === 0, errors };
  }

  mapToInternal(externalRecord: unknown, _entityType: string): unknown {
    const ext = externalRecord as Record<string, unknown>;
    return {
      indicatorCode: ext['IndicatorCode'] ?? ext['indicatorCode'],
      countryCode: ext['SpatialDim'] ?? ext['countryCode'],
      year: ext['TimeDim'] ?? ext['year'],
      value: ext['NumericValue'] ?? ext['value'],
      source: 'OMS',
    };
  }

  mapToExternal(internalRecord: unknown, _entityType: string): unknown {
    const int = internalRecord as Record<string, unknown>;
    return {
      IndicatorCode: int['indicatorCode'],
      SpatialDim: int['countryCode'],
      TimeDim: int['year'],
      NumericValue: int['value'],
      source_system: 'ARIS',
    };
  }
}
