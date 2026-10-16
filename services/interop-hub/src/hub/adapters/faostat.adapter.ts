// ═══════════════════════════════════════════════════════════════════
//  FAOSTAT Adapter — FAO Statistics
//  Converts ARIS livestock production/census data to FAOSTAT format.
//  Supports FAOSTAT_CSV and FAOSTAT_JSON export formats.
// ═══════════════════════════════════════════════════════════════════

import {
  BaseAdapter,
  type AdapterConfig,
  type FormatBuildResult,
  type DeliveryResult,
  type PullResult,
  type HealthCheckResult,
} from './base.adapter';

const FAOSTAT_API_BASE = 'https://fenixservices.fao.org/faostat/api/v1';

/** ARIS element codes to FAOSTAT element mapping */
const ELEMENT_MAP: Record<string, { code: string; name: string; unit: string }> = {
  stocks:      { code: '5111', name: 'Stocks', unit: 'Head' },
  production:  { code: '5510', name: 'Production', unit: 'tonnes' },
  yield:       { code: '5421', name: 'Yield', unit: 'Hg/An' },
  slaughtered: { code: '5320', name: 'Producing Animals/Slaughtered', unit: 'Head' },
  milk:        { code: '5510', name: 'Production', unit: 'tonnes' },
  eggs:        { code: '5510', name: 'Production', unit: 'tonnes' },
  wool:        { code: '5510', name: 'Production', unit: 'tonnes' },
  meat:        { code: '5510', name: 'Production', unit: 'tonnes' },
};

const CSV_HEADERS = [
  'AreaCode', 'Area', 'ItemCode', 'Item', 'ElementCode', 'Element',
  'Year', 'Unit', 'Value', 'Flag',
];

export class FaostatAdapter extends BaseAdapter {
  readonly systemType = 'FAOSTAT';
  readonly displayName = 'FAOSTAT (FAO)';

  // ─── FORMAT BUILD ────────────────────────────────────────────────

  async formatBuild(
    records: Record<string, unknown>[],
    config: AdapterConfig & Record<string, unknown>,
  ): Promise<FormatBuildResult> {
    const format = (config.format as string) ?? 'FAOSTAT_CSV';
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');

    const rows = records.map(record => this.buildFaostatRow(record, config));

    if (format === 'FAOSTAT_JSON') {
      const payload = {
        metadata: {
          source: 'ARIS',
          generated_at: now.toISOString(),
          generator: 'ARIS-InteropHub/1.0',
          record_count: rows.length,
        },
        data: rows,
      };

      return {
        format: 'FAOSTAT_JSON',
        data: JSON.stringify(payload, null, 2),
        contentType: 'application/json',
        filename: `faostat-data-${timestamp}.json`,
        recordCount: records.length,
      };
    }

    // Default: FAOSTAT_CSV
    const csvRows = rows.map(row => [
      String(row.AreaCode),
      String(row.Area),
      String(row.ItemCode),
      String(row.Item),
      String(row.ElementCode),
      String(row.Element),
      String(row.Year),
      String(row.Unit),
      String(row.Value),
      String(row.Flag),
    ]);

    return {
      format: 'FAOSTAT_CSV',
      data: this.buildCsv(CSV_HEADERS, csvRows),
      contentType: 'text/csv',
      filename: `faostat-data-${timestamp}.csv`,
      recordCount: records.length,
    };
  }

  private buildFaostatRow(
    record: Record<string, unknown>,
    config: Record<string, unknown>,
  ): Record<string, unknown> {
    // Map ARIS country code to FAO Area code
    // FAO area codes can be provided via config.area_code_map or fall back to ISO numeric
    const areaCodeMap = (config.area_code_map ?? {}) as Record<string, string>;
    const countryCode = String(record.country_code ?? record.country_iso3 ?? '');
    const areaCode = areaCodeMap[countryCode] ?? record.fao_area_code ?? countryCode;

    // Map ARIS species code to FAO Item code
    const itemCodeMap = (config.item_code_map ?? {}) as Record<string, string>;
    const speciesCode = String(record.species_code ?? '');
    const itemCode = itemCodeMap[speciesCode] ?? record.fao_item_code ?? speciesCode;

    // Determine element type
    const elementType = String(record.element_type ?? record.indicator ?? 'stocks').toLowerCase();
    const element = ELEMENT_MAP[elementType] ?? ELEMENT_MAP['stocks']!;

    // Value and flag
    const value = record.value ?? record.quantity ?? record.count ?? 0;
    // FAOSTAT flags: A=aggregate, E=estimated, F=forecast, I=imputed, M=missing, T=trend
    const flag = record.flag ?? record.fao_flag ?? 'A';

    return {
      AreaCode: areaCode,
      Area: record.country_name ?? '',
      ItemCode: itemCode,
      Item: record.species_name ?? record.item_name ?? '',
      ElementCode: element.code,
      Element: element.name,
      Year: record.year ?? record.period ?? new Date().getFullYear(),
      Unit: record.unit ?? element.unit,
      Value: value,
      Flag: flag,
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
        responseBody: 'No FAOSTAT submission endpoint configured. Data available for manual download/SFTP.',
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
        error: response.ok ? undefined : `FAOSTAT returned HTTP ${response.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        deliveredAt: new Date(),
        error: `FAOSTAT delivery failed: ${err.message}`,
      };
    }
  }

  // ─── PULL ────────────────────────────────────────────────────────

  async pull(
    config: AdapterConfig,
    params: Record<string, unknown>,
  ): Promise<PullResult> {
    const baseUrl = config.baseUrl ?? FAOSTAT_API_BASE;

    try {
      // FAOSTAT public API: /en/data/{domain}
      const domain = (params.domain as string) ?? 'QCL'; // QCL = Crops and livestock products
      const areaCode = params.area_code ?? params.country;
      const year = params.year;
      const itemCode = params.item_code;

      const queryParts: string[] = [];
      if (areaCode) queryParts.push(`area=${encodeURIComponent(String(areaCode))}`);
      if (year) queryParts.push(`year=${encodeURIComponent(String(year))}`);
      if (itemCode) queryParts.push(`item=${encodeURIComponent(String(itemCode))}`);

      const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
      const url = `${baseUrl}/en/data/${domain}${queryString}`;

      const headers: Record<string, string> = { Accept: 'application/json' };
      // FAOSTAT public API does not require auth, but include if provided
      Object.assign(headers, this.buildAuthHeaders(config));

      const response = await this.httpRequest(url, {
        method: 'GET',
        headers,
        timeout: 30_000,
      });

      if (!response.ok) {
        return {
          records: [],
          metadata: { error: `FAOSTAT API returned HTTP ${response.status}` },
        };
      }

      const body = await response.json() as Record<string, unknown>;
      const records = (body.data ?? body.Data ?? []) as Record<string, unknown>[];

      return {
        records,
        metadata: { domain, source: 'FAOSTAT' },
      };
    } catch (err: any) {
      return {
        records: [],
        metadata: { error: `FAOSTAT pull failed: ${err.message}` },
      };
    }
  }

  // ─── HEALTH CHECK ────────────────────────────────────────────────

  async healthCheck(config: AdapterConfig): Promise<HealthCheckResult> {
    const url = config.baseUrl ?? FAOSTAT_API_BASE;
    const start = Date.now();

    try {
      const response = await this.httpRequest(`${url}/en/data/QCL`, {
        method: 'HEAD',
        timeout: 10_000,
      });

      return {
        status: response.ok ? 'UP' : 'DEGRADED',
        responseTimeMs: Date.now() - start,
        statusCode: response.status,
        message: response.ok ? 'FAOSTAT API reachable' : `HTTP ${response.status}`,
      };
    } catch (err: any) {
      const elapsed = Date.now() - start;
      return {
        status: elapsed >= 10_000 ? 'TIMEOUT' : 'DOWN',
        responseTimeMs: elapsed,
        message: `FAOSTAT health check failed: ${err.message}`,
      };
    }
  }
}
