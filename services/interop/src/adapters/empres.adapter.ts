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
 * EMPRES — FAO Emergency Prevention System (EMPRES-i) adapter.
 * Pushes disease signals with confidence scores.
 */
export class EmpresAdapter extends BaseAdapter {
  readonly system = 'EMPRES';
  readonly displayName = 'FAO EMPRES-i';

  async connect(_config: AdapterConfig): Promise<void> {}
  async disconnect(): Promise<void> {}

  async testConnection(config: AdapterConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const headers = this.buildAuthHeaders(config);
      const { status } = await this.httpRequest(
        `${config.baseUrl}/api/v1/events/status`,
        'GET',
        headers,
      );
      return {
        success: status >= 200 && status < 300,
        message: status >= 200 && status < 300 ? 'EMPRES-i connection successful' : `HTTP ${status}`,
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
        const signal = this.mapToExternal(record, 'signal');
        const { status } = await this.httpRequest(
          `${config.baseUrl}/api/v1/signals`,
          'POST',
          headers,
          signal,
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
    if (params.since) queryParts.push(`startDate=${params.since.toISOString().slice(0, 10)}`);
    if (params.filters?.['country']) queryParts.push(`country=${params.filters['country']}`);
    if (params.filters?.['disease']) queryParts.push(`disease=${params.filters['disease']}`);
    const qs = queryParts.length ? `?${queryParts.join('&')}` : '';

    try {
      const { status, data } = await this.httpRequest(
        `${config.baseUrl}/api/v1/events${qs}`,
        'GET',
        headers,
      );
      if (status >= 200 && status < 300 && Array.isArray(data)) {
        return { records: data.map((r) => this.mapToInternal(r, 'signal')), total: data.length };
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
    if (!r['confidenceLevel']) errors.push('confidenceLevel is required');
    return { valid: errors.length === 0, errors };
  }

  mapToInternal(externalRecord: unknown, _entityType: string): unknown {
    const ext = externalRecord as Record<string, unknown>;
    return {
      eventId: ext['event_id'],
      diseaseId: ext['disease'],
      countryCode: ext['country'],
      confidenceLevel: ext['confidence'] ?? 'VERIFIED',
      reportDate: ext['observation_date'] ?? ext['reportDate'],
      latitude: ext['latitude'],
      longitude: ext['longitude'],
      species: ext['animal_type'],
      cases: ext['cases'],
      deaths: ext['deaths'],
      source: 'EMPRES',
    };
  }

  mapToExternal(internalRecord: unknown, _entityType: string): unknown {
    const int = internalRecord as Record<string, unknown>;
    return {
      disease: int['diseaseId'],
      country: int['countryCode'],
      observation_date: int['reportDate'],
      confidence: int['confidenceLevel'] ?? 'CONFIRMED',
      latitude: int['latitude'],
      longitude: int['longitude'],
      animal_type: int['species'],
      cases: int['cases'],
      deaths: int['deaths'],
      source_system: 'ARIS',
      signal_type: 'ANIMAL_HEALTH',
    };
  }
}
