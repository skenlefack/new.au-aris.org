// ═══════════════════════════════════════════════════════════════════
//  CITES Adapter — Convention on International Trade in Endangered Species
//  Converts ARIS wildlife permits to CITES annual report CSV format.
// ═══════════════════════════════════════════════════════════════════

import {
  BaseAdapter,
  type AdapterConfig,
  type FormatBuildResult,
  type DeliveryResult,
  type PullResult,
  type HealthCheckResult,
} from './base.adapter';

const CITES_TRADE_DB_URL = 'https://trade.cites.org/api/v1';

const CSV_HEADERS = [
  'Year', 'Country', 'Taxon', 'Appendix', 'Term', 'Purpose',
  'Source', 'Importer', 'Exporter', 'Quantity', 'Unit',
];

/**
 * CITES Purpose codes:
 *   B=Breeding, E=Educational, G=Botanical garden, H=Hunting trophy,
 *   L=Law enforcement, M=Medical, N=Nature conservation, P=Personal,
 *   Q=Circus, S=Scientific, T=Commercial trade, Z=Zoo
 *
 * CITES Source codes:
 *   A=Plants (artificially propagated), C=Captive-bred, D=Appendix I captive-bred,
 *   F=F1 born in captivity, I=Confiscated, O=Pre-Convention, R=Ranched,
 *   U=Unknown, W=Wild
 */

export class CitesAdapter extends BaseAdapter {
  readonly systemType = 'CITES';
  readonly displayName = 'CITES';

  // ─── FORMAT BUILD ────────────────────────────────────────────────

  async formatBuild(
    records: Record<string, unknown>[],
    config: AdapterConfig & Record<string, unknown>,
  ): Promise<FormatBuildResult> {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');

    const rows = records.map(record => this.buildCitesRow(record));

    const csv = this.buildCsv(CSV_HEADERS, rows);

    return {
      format: 'CITES_CSV',
      data: csv,
      contentType: 'text/csv',
      filename: `cites-annual-report-${timestamp}.csv`,
      recordCount: records.length,
    };
  }

  private buildCitesRow(record: Record<string, unknown>): string[] {
    // Map ARIS term to CITES term
    const termRaw = String(record.term ?? record.specimen_type ?? 'live').toLowerCase();
    const term = this.mapTerm(termRaw);

    // Map purpose
    const purposeRaw = String(record.purpose ?? record.trade_purpose ?? 'T').toUpperCase();
    const purpose = purposeRaw.charAt(0); // Single letter code

    // Map source
    const sourceRaw = String(record.source ?? record.specimen_source ?? 'W').toUpperCase();
    const source = sourceRaw.charAt(0);

    // Appendix (I, II, or III)
    const appendix = String(record.appendix ?? record.cites_appendix ?? '');

    return [
      String(record.year ?? record.permit_year ?? new Date().getFullYear()),
      String(record.country_code ?? record.country ?? ''),
      String(record.taxon ?? record.species_name ?? record.scientific_name ?? ''),
      appendix,
      term,
      purpose,
      source,
      String(record.importer ?? record.importing_country ?? ''),
      String(record.exporter ?? record.exporting_country ?? ''),
      String(record.quantity ?? record.number ?? 0),
      String(record.unit ?? 'specimens'),
    ];
  }

  private mapTerm(raw: string): string {
    const termMap: Record<string, string> = {
      live: 'live',
      skin: 'skins',
      skins: 'skins',
      trophy: 'trophies',
      trophies: 'trophies',
      bone: 'bones',
      bones: 'bones',
      ivory: 'ivory',
      feather: 'feathers',
      feathers: 'feathers',
      egg: 'eggs',
      eggs: 'eggs',
      meat: 'meat',
      specimen: 'specimens',
      specimens: 'specimens',
      derivative: 'derivatives',
      derivatives: 'derivatives',
    };
    return termMap[raw] ?? raw;
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
        responseBody: 'No CITES endpoint configured. Data available for manual download.',
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
        timeout: 30_000,
      });

      const responseBody = await response.text();
      return {
        success: response.ok,
        statusCode: response.status,
        responseBody: responseBody.slice(0, 2000),
        deliveredAt: new Date(),
        error: response.ok ? undefined : `CITES returned HTTP ${response.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        deliveredAt: new Date(),
        error: `CITES delivery failed: ${err.message}`,
      };
    }
  }

  // ─── PULL ────────────────────────────────────────────────────────

  async pull(
    config: AdapterConfig,
    params: Record<string, unknown>,
  ): Promise<PullResult> {
    const baseUrl = config.baseUrl ?? CITES_TRADE_DB_URL;

    try {
      const queryParts: string[] = [];
      if (params.taxon) queryParts.push(`taxon=${encodeURIComponent(String(params.taxon))}`);
      if (params.country) queryParts.push(`country=${encodeURIComponent(String(params.country))}`);
      if (params.year) queryParts.push(`year=${encodeURIComponent(String(params.year))}`);
      if (params.appendix) queryParts.push(`appendix=${encodeURIComponent(String(params.appendix))}`);
      if (params.limit) queryParts.push(`limit=${encodeURIComponent(String(params.limit))}`);
      if (params.offset) queryParts.push(`offset=${encodeURIComponent(String(params.offset))}`);

      const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
      const url = `${baseUrl}/trades${queryString}`;

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
          metadata: { error: `CITES API returned HTTP ${response.status}` },
        };
      }

      const body = await response.json() as Record<string, unknown>;
      const records = (body.data ?? body.trades ?? body.results ?? []) as Record<string, unknown>[];

      return { records, metadata: { source: 'CITES Trade Database' } };
    } catch (err: any) {
      return {
        records: [],
        metadata: { error: `CITES pull failed: ${err.message}` },
      };
    }
  }

  // ─── HEALTH CHECK ────────────────────────────────────────────────

  async healthCheck(config: AdapterConfig): Promise<HealthCheckResult> {
    const url = config.baseUrl ?? CITES_TRADE_DB_URL;
    const start = Date.now();

    try {
      const response = await this.httpRequest(url, {
        method: 'HEAD',
        timeout: 10_000,
      });

      return {
        status: response.ok ? 'UP' : 'DEGRADED',
        responseTimeMs: Date.now() - start,
        statusCode: response.status,
        message: response.ok ? 'CITES API reachable' : `HTTP ${response.status}`,
      };
    } catch (err: any) {
      const elapsed = Date.now() - start;
      return {
        status: elapsed >= 10_000 ? 'TIMEOUT' : 'DOWN',
        responseTimeMs: elapsed,
        message: `CITES health check failed: ${err.message}`,
      };
    }
  }
}
