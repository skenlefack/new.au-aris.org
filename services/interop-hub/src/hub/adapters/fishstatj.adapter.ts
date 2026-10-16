// ═══════════════════════════════════════════════════════════════════
//  FishStatJ Adapter — FAO Fisheries and Aquaculture Statistics
//  Converts ARIS fisheries data to FishStatJ CSV format.
// ═══════════════════════════════════════════════════════════════════

import {
  BaseAdapter,
  type AdapterConfig,
  type FormatBuildResult,
  type DeliveryResult,
  type PullResult,
  type HealthCheckResult,
} from './base.adapter';

const CSV_HEADERS = [
  'Country', 'Year', 'Species_ASFIS_Code', 'Species_Name',
  'FAO_Area', 'Production_Source', 'Quantity_Tonnes', 'Value_USD',
];

export class FishstatjAdapter extends BaseAdapter {
  readonly systemType = 'FISHSTATJ';
  readonly displayName = 'FishStatJ (FAO)';

  // ─── FORMAT BUILD ────────────────────────────────────────────────

  async formatBuild(
    records: Record<string, unknown>[],
    config: AdapterConfig & Record<string, unknown>,
  ): Promise<FormatBuildResult> {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');

    // Map ARIS species to ASFIS codes if mapping provided
    const asfisMap = (config.asfis_code_map ?? {}) as Record<string, string>;
    const areaMap = (config.fao_area_map ?? {}) as Record<string, string>;

    const rows = records.map(record => {
      const speciesCode = String(record.species_code ?? record.asfis_code ?? '');
      const asfisCode = asfisMap[speciesCode] ?? record.asfis_code ?? speciesCode;

      const fishingArea = String(record.fishing_area ?? record.fao_area ?? '');
      const faoArea = areaMap[fishingArea] ?? record.fao_area ?? fishingArea;

      // Production source: C = Capture, A = Aquaculture
      const sourceRaw = String(record.production_source ?? record.source_type ?? 'C').toUpperCase();
      const productionSource = sourceRaw.startsWith('A') ? 'A' : 'C';

      return [
        String(record.country_name ?? record.country ?? ''),
        String(record.year ?? record.period ?? new Date().getFullYear()),
        String(asfisCode),
        String(record.species_name ?? ''),
        String(faoArea),
        productionSource,
        String(record.quantity ?? record.quantity_tonnes ?? record.production ?? 0),
        String(record.value ?? record.value_usd ?? 0),
      ];
    });

    const csv = this.buildCsv(CSV_HEADERS, rows);

    return {
      format: 'FISHSTATJ_CSV',
      data: csv,
      contentType: 'text/csv',
      filename: `fishstatj-data-${timestamp}.csv`,
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
        success: true,
        deliveredAt: new Date(),
        responseBody: 'No FishStatJ endpoint configured. Data available for manual download/SFTP.',
      };
    }

    try {
      const headers = this.buildAuthHeaders(config);
      headers['Content-Type'] = formatted.contentType;
      headers['User-Agent'] = 'ARIS-InteropHub/1.0';

      const response = await this.httpRequest(url, {
        method: 'POST',
        headers,
        body: typeof formatted.data === 'string' ? formatted.data : formatted.data.toString('utf-8'),
        timeout: 60_000,
      });

      const responseBody = await response.text();
      return {
        success: response.ok,
        statusCode: response.status,
        responseBody: responseBody.slice(0, 2000),
        deliveredAt: new Date(),
        error: response.ok ? undefined : `FishStatJ returned HTTP ${response.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        deliveredAt: new Date(),
        error: `FishStatJ delivery failed: ${err.message}`,
      };
    }
  }

  // ─── PULL ────────────────────────────────────────────────────────

  async pull(
    _config: AdapterConfig,
    _params: Record<string, unknown>,
  ): Promise<PullResult> {
    // FishStatJ does not have a public pull API.
    return {
      records: [],
      metadata: { note: 'FishStatJ does not expose a public API for data pull. Use FAOSTAT API or manual download.' },
    };
  }

  // ─── HEALTH CHECK ────────────────────────────────────────────────

  async healthCheck(_config: AdapterConfig): Promise<HealthCheckResult> {
    // No publicly accessible health endpoint for FishStatJ.
    return {
      status: 'UP',
      responseTimeMs: 0,
      message: 'FishStatJ adapter is available (no remote health endpoint to check).',
    };
  }
}
