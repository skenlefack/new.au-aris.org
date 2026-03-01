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
 * FAOSTAT — FAO Statistical Database adapter.
 * Pulls livestock denominators and reconciles with national census data.
 */
export class FaostatAdapter extends BaseAdapter {
  readonly system = 'FAOSTAT';
  readonly displayName = 'FAOSTAT';

  async connect(_config: AdapterConfig): Promise<void> {}
  async disconnect(): Promise<void> {}

  async testConnection(config: AdapterConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const headers = this.buildAuthHeaders(config);
      const { status } = await this.httpRequest(
        `${config.baseUrl}/api/v1/en/definitions/domain`,
        'GET',
        headers,
      );
      return {
        success: status >= 200 && status < 300,
        message: status >= 200 && status < 300 ? 'FAOSTAT API reachable' : `HTTP ${status}`,
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
        const payload = this.mapToExternal(record, 'production');
        const { status } = await this.httpRequest(
          `${config.baseUrl}/api/v1/data`,
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
    if (params.filters?.['areaCode']) queryParts.push(`area=${params.filters['areaCode']}`);
    if (params.filters?.['itemCode']) queryParts.push(`item=${params.filters['itemCode']}`);
    if (params.filters?.['year']) queryParts.push(`year=${params.filters['year']}`);
    if (params.filters?.['element']) queryParts.push(`element=${params.filters['element']}`);
    const qs = queryParts.length ? `?${queryParts.join('&')}` : '';

    try {
      const { status, data } = await this.httpRequest(
        `${config.baseUrl}/api/v1/en/data/QL${qs}`,
        'GET',
        headers,
      );
      if (status >= 200 && status < 300) {
        const resp = data as Record<string, unknown>;
        const values = (resp['data'] as unknown[]) ?? [];
        return {
          records: values.map((v) => this.mapToInternal(v, 'production')),
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
    if (!r['countryCode'] && !r['areaCode']) errors.push('countryCode or areaCode is required');
    if (!r['year']) errors.push('year is required');
    if (r['value'] == null) errors.push('value is required');
    return { valid: errors.length === 0, errors };
  }

  mapToInternal(externalRecord: unknown, _entityType: string): unknown {
    const ext = externalRecord as Record<string, unknown>;
    return {
      areaCode: ext['Area Code'] ?? ext['areaCode'],
      countryName: ext['Area'] ?? ext['countryName'],
      itemCode: ext['Item Code'] ?? ext['itemCode'],
      itemName: ext['Item'] ?? ext['itemName'],
      elementCode: ext['Element Code'] ?? ext['elementCode'],
      elementName: ext['Element'] ?? ext['elementName'],
      year: ext['Year'] ?? ext['year'],
      value: ext['Value'] ?? ext['value'],
      unit: ext['Unit'] ?? ext['unit'],
      flag: ext['Flag'] ?? ext['flag'],
      source: 'FAOSTAT',
    };
  }

  mapToExternal(internalRecord: unknown, _entityType: string): unknown {
    const int = internalRecord as Record<string, unknown>;
    return {
      'Area Code': int['areaCode'] ?? int['countryCode'],
      'Item Code': int['itemCode'] ?? int['speciesCode'],
      'Element Code': int['elementCode'] ?? '5112',
      Year: int['year'],
      Value: int['value'],
      Unit: int['unit'] ?? 'Head',
      source_system: 'ARIS',
    };
  }
}
