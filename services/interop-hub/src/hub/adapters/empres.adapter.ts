// ═══════════════════════════════════════════════════════════════════
//  EMPRES Adapter — FAO Emergency Prevention System
//  Converts ARIS health events to EMPRES signal format.
// ═══════════════════════════════════════════════════════════════════

import {
  BaseAdapter,
  type AdapterConfig,
  type FormatBuildResult,
  type DeliveryResult,
  type PullResult,
  type HealthCheckResult,
} from './base.adapter';

export class EmpresAdapter extends BaseAdapter {
  readonly systemType = 'EMPRES';
  readonly displayName = 'EMPRES (FAO)';

  // ─── FORMAT BUILD ────────────────────────────────────────────────

  async formatBuild(
    records: Record<string, unknown>[],
    config: AdapterConfig & Record<string, unknown>,
  ): Promise<FormatBuildResult> {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');

    const signals = records.map((record, index) => this.buildSignal(record, index));

    const payload = {
      metadata: {
        source: 'ARIS',
        generated_at: now.toISOString(),
        generator: 'ARIS-InteropHub/1.0',
        record_count: signals.length,
      },
      signals,
    };

    const data = JSON.stringify(payload, null, 2);
    return {
      format: 'EMPRES_JSON',
      data,
      contentType: 'application/json',
      filename: `empres-signals-${timestamp}.json`,
      recordCount: records.length,
    };
  }

  private buildSignal(record: Record<string, unknown>, index: number): Record<string, unknown> {
    // Map ARIS confidence levels to EMPRES levels
    const confidenceMap: Record<string, string> = {
      rumor: 'RUMOR',
      unverified: 'RUMOR',
      verified: 'VERIFIED',
      suspected: 'VERIFIED',
      confirmed: 'CONFIRMED',
      laboratory_confirmed: 'CONFIRMED',
    };
    const rawConfidence = String(record.confidence ?? record.confidence_level ?? 'confirmed').toLowerCase();
    const confidence = confidenceMap[rawConfidence] ?? 'CONFIRMED';

    return {
      signalId: (record.id as string) ?? `aris-signal-${index}`,
      diseaseCode: record.disease_code ?? record.oie_code ?? '',
      diseaseName: record.disease_name ?? '',
      speciesCode: record.species_code ?? '',
      speciesName: record.species_name ?? '',
      countryISO3: record.country_code ?? record.country_iso3 ?? '',
      countryName: record.country_name ?? '',
      coordinates: {
        lat: record.latitude ?? record.lat ?? null,
        lng: record.longitude ?? record.lng ?? null,
      },
      location: record.location_name ?? record.admin1_name ?? '',
      dateReported: this.formatDateTime(record.date_report ?? record.reported_at),
      dateEvent: this.formatDateTime(record.date_suspicion ?? record.suspected_at ?? record.event_date),
      dateConfirmation: this.formatDateTime(record.date_confirmation ?? record.confirmed_at),
      cases: record.cases ?? record.cases_total ?? 0,
      deaths: record.deaths ?? record.deaths_total ?? 0,
      susceptible: record.susceptible ?? record.cases_susceptible ?? 0,
      confidenceLevel: confidence,
      context: record.context ?? record.description ?? record.notes ?? '',
      controlMeasures: record.control_measures ?? record.measures ?? [],
      source: 'ARIS',
      sourceReference: record.reference ?? record.event_id ?? '',
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
        success: true,
        deliveredAt: new Date(),
        responseBody: 'No EMPRES endpoint configured. Data available for manual download.',
      };
    }

    try {
      const headers = this.buildAuthHeaders(config);
      headers['Content-Type'] = 'application/json';
      headers['User-Agent'] = 'ARIS-InteropHub/1.0';

      const response = await this.httpRequest(url, {
        method: 'POST',
        headers,
        body: typeof formatted.data === 'string' ? formatted.data : formatted.data.toString('utf-8'),
        timeout: 30_000,
      });

      const responseBody = await response.text();
      return {
        success: response.ok,
        statusCode: response.status,
        responseBody: responseBody.slice(0, 2000),
        deliveredAt: new Date(),
        error: response.ok ? undefined : `EMPRES returned HTTP ${response.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        deliveredAt: new Date(),
        error: `EMPRES delivery failed: ${err.message}`,
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
      return { records: [], metadata: { note: 'No EMPRES endpoint configured for pull.' } };
    }

    try {
      // Build query params for EMPRES alerts API
      const queryParts: string[] = [];
      if (params.country) queryParts.push(`country=${encodeURIComponent(String(params.country))}`);
      if (params.disease) queryParts.push(`disease=${encodeURIComponent(String(params.disease))}`);
      if (params.date_from) queryParts.push(`date_from=${encodeURIComponent(String(params.date_from))}`);
      if (params.date_to) queryParts.push(`date_to=${encodeURIComponent(String(params.date_to))}`);
      if (params.limit) queryParts.push(`limit=${encodeURIComponent(String(params.limit))}`);
      if (params.offset) queryParts.push(`offset=${encodeURIComponent(String(params.offset))}`);

      const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
      const url = `${baseUrl}/alerts${queryString}`;

      const headers = this.buildAuthHeaders(config);
      headers['Accept'] = 'application/json';

      const response = await this.httpRequest(url, {
        method: 'GET',
        headers,
        timeout: 30_000,
      });

      if (!response.ok) {
        return {
          records: [],
          metadata: { error: `EMPRES returned HTTP ${response.status}` },
        };
      }

      const body = await response.json() as Record<string, unknown>;
      const records = (body.data ?? body.alerts ?? body.results ?? []) as Record<string, unknown>[];
      const hasMore = Boolean(body.has_more ?? body.hasMore);
      const cursor = (body.next_cursor ?? body.nextCursor) as string | undefined;

      return { records, hasMore, cursor };
    } catch (err: any) {
      return {
        records: [],
        metadata: { error: `EMPRES pull failed: ${err.message}` },
      };
    }
  }

  // ─── HEALTH CHECK ────────────────────────────────────────────────

  async healthCheck(config: AdapterConfig): Promise<HealthCheckResult> {
    const url = config.baseUrl;
    if (!url) {
      return {
        status: 'DOWN',
        responseTimeMs: 0,
        message: 'No EMPRES endpoint configured',
      };
    }

    const start = Date.now();
    try {
      const headers = this.buildAuthHeaders(config);
      const response = await this.httpRequest(`${url}/health`, {
        method: 'GET',
        headers,
        timeout: 10_000,
      });

      return {
        status: response.ok ? 'UP' : 'DEGRADED',
        responseTimeMs: Date.now() - start,
        statusCode: response.status,
        message: response.ok ? 'EMPRES API reachable' : `HTTP ${response.status}`,
      };
    } catch (err: any) {
      const elapsed = Date.now() - start;
      return {
        status: elapsed >= 10_000 ? 'TIMEOUT' : 'DOWN',
        responseTimeMs: elapsed,
        message: `EMPRES health check failed: ${err.message}`,
      };
    }
  }
}
