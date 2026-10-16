// ═══════════════════════════════════════════════════════════════════
//  DHIS2 Adapter — District Health Information Software 2
//  Converts ARIS records to DHIS2 data value sets and back.
// ═══════════════════════════════════════════════════════════════════

import {
  BaseAdapter,
  type AdapterConfig,
  type FormatBuildResult,
  type DeliveryResult,
  type PullResult,
  type HealthCheckResult,
} from './base.adapter';

interface Dhis2DataValue {
  dataElement: string;
  categoryOptionCombo?: string;
  value: string;
}

interface Dhis2DataValueSet {
  dataSet: string;
  period: string;
  orgUnit: string;
  completeDate?: string;
  dataValues: Dhis2DataValue[];
}

export class Dhis2Adapter extends BaseAdapter {
  readonly systemType = 'DHIS2';
  readonly displayName = 'DHIS2';

  // ─── FORMAT BUILD ────────────────────────────────────────────────

  async formatBuild(
    records: Record<string, unknown>[],
    config: AdapterConfig & Record<string, unknown>,
  ): Promise<FormatBuildResult> {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');

    // Config for DHIS2 mapping
    const dataSet = (config.data_set ?? config.dataSet ?? '') as string;
    const orgUnit = (config.org_unit ?? config.orgUnit ?? '') as string;
    const period = (config.period ?? this.defaultPeriod()) as string;
    const dataElementMap = (config.data_element_map ?? config.dataElementMap ?? {}) as Record<string, string>;
    const categoryOptionCombo = (config.category_option_combo ?? config.categoryOptionCombo) as string | undefined;

    const dataValueSets: Dhis2DataValueSet[] = [];

    // Group records by org unit and period if they have those fields,
    // otherwise use the config defaults
    const groups = new Map<string, Record<string, unknown>[]>();

    for (const record of records) {
      const recOrgUnit = (record.dhis2_org_unit ?? record.org_unit ?? orgUnit) as string;
      const recPeriod = (record.dhis2_period ?? record.period ?? period) as string;
      const key = `${recOrgUnit}|${recPeriod}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(record);
    }

    for (const [key, groupRecords] of groups) {
      const [groupOrgUnit, groupPeriod] = key.split('|') as [string, string];
      const dataValues: Dhis2DataValue[] = [];

      for (const record of groupRecords) {
        // Map each ARIS field to a DHIS2 data element
        for (const [arisField, dhis2Element] of Object.entries(dataElementMap)) {
          const value = record[arisField];
          if (value !== undefined && value !== null && value !== '') {
            const dv: Dhis2DataValue = {
              dataElement: dhis2Element,
              value: String(value),
            };
            if (categoryOptionCombo) {
              dv.categoryOptionCombo = categoryOptionCombo;
            }
            // Per-record category option combo override
            const recCoc = record.dhis2_category_option_combo as string | undefined;
            if (recCoc) {
              dv.categoryOptionCombo = recCoc;
            }
            dataValues.push(dv);
          }
        }

        // If no mapping provided, attempt direct mapping from dhis2_data_values field
        if (Object.keys(dataElementMap).length === 0 && Array.isArray(record.dhis2_data_values)) {
          for (const dv of record.dhis2_data_values as Dhis2DataValue[]) {
            dataValues.push(dv);
          }
        }
      }

      if (dataValues.length > 0) {
        dataValueSets.push({
          dataSet: (groupRecords[0]?.dhis2_data_set as string) ?? dataSet,
          period: groupPeriod,
          orgUnit: groupOrgUnit,
          completeDate: now.toISOString().split('T')[0],
          dataValues,
        });
      }
    }

    const payload = { dataValueSets };
    const data = JSON.stringify(payload, null, 2);

    return {
      format: 'DHIS2_JSON',
      data,
      contentType: 'application/json',
      filename: `dhis2-datavalues-${timestamp}.json`,
      recordCount: records.length,
      metadata: {
        dataValueSetCount: dataValueSets.length,
        totalDataValues: dataValueSets.reduce((sum, dvs) => sum + dvs.dataValues.length, 0),
      },
    };
  }

  private defaultPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}${month}`;
  }

  // ─── DELIVER ─────────────────────────────────────────────────────

  async deliver(
    formatted: FormatBuildResult,
    config: AdapterConfig,
  ): Promise<DeliveryResult> {
    const baseUrl = config.baseUrl;
    if (!baseUrl) {
      return {
        success: false,
        deliveredAt: new Date(),
        error: 'No DHIS2 base URL configured',
      };
    }

    try {
      const url = `${baseUrl.replace(/\/+$/, '')}/api/dataValueSets`;
      const headers = this.buildAuthHeaders(config);
      headers['Content-Type'] = 'application/json';
      headers['User-Agent'] = 'ARIS-InteropHub/1.0';

      const response = await this.httpRequest(url, {
        method: 'POST',
        headers,
        body: typeof formatted.data === 'string' ? formatted.data : formatted.data.toString('utf-8'),
        timeout: 60_000,
      });

      const responseBody = await response.text();

      // DHIS2 returns import summary with status
      let importSummary: Record<string, unknown> | undefined;
      try {
        importSummary = JSON.parse(responseBody) as Record<string, unknown>;
      } catch {
        // Response may not be JSON
      }

      return {
        success: response.ok,
        statusCode: response.status,
        responseBody: responseBody.slice(0, 2000),
        deliveredAt: new Date(),
        error: response.ok ? undefined : `DHIS2 returned HTTP ${response.status}: ${importSummary?.message ?? ''}`,
      };
    } catch (err: any) {
      return {
        success: false,
        deliveredAt: new Date(),
        error: `DHIS2 delivery failed: ${err.message}`,
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
      return { records: [], metadata: { error: 'No DHIS2 base URL configured' } };
    }

    try {
      const headers = this.buildAuthHeaders(config);
      headers['Accept'] = 'application/json';

      // Determine which DHIS2 API to call
      const apiType = (params.api_type as string) ?? 'dataValueSets';

      if (apiType === 'analytics') {
        return this.pullAnalytics(baseUrl, headers, params);
      }

      // Default: dataValueSets
      return this.pullDataValueSets(baseUrl, headers, params);
    } catch (err: any) {
      return {
        records: [],
        metadata: { error: `DHIS2 pull failed: ${err.message}` },
      };
    }
  }

  private async pullDataValueSets(
    baseUrl: string,
    headers: Record<string, string>,
    params: Record<string, unknown>,
  ): Promise<PullResult> {
    const queryParts: string[] = [];
    if (params.dataSet) queryParts.push(`dataSet=${encodeURIComponent(String(params.dataSet))}`);
    if (params.period) queryParts.push(`period=${encodeURIComponent(String(params.period))}`);
    if (params.orgUnit) queryParts.push(`orgUnit=${encodeURIComponent(String(params.orgUnit))}`);
    if (params.startDate) queryParts.push(`startDate=${encodeURIComponent(String(params.startDate))}`);
    if (params.endDate) queryParts.push(`endDate=${encodeURIComponent(String(params.endDate))}`);

    const url = `${baseUrl.replace(/\/+$/, '')}/api/dataValueSets?${queryParts.join('&')}`;

    const response = await this.httpRequest(url, {
      method: 'GET',
      headers,
      timeout: 30_000,
    });

    if (!response.ok) {
      return { records: [], metadata: { error: `DHIS2 returned HTTP ${response.status}` } };
    }

    const body = await response.json() as Record<string, unknown>;
    const dataValues = (body.dataValues ?? []) as Record<string, unknown>[];

    return {
      records: dataValues,
      metadata: { source: 'DHIS2 dataValueSets' },
    };
  }

  private async pullAnalytics(
    baseUrl: string,
    headers: Record<string, string>,
    params: Record<string, unknown>,
  ): Promise<PullResult> {
    const queryParts: string[] = [];
    if (params.dimension) {
      const dims = Array.isArray(params.dimension) ? params.dimension : [params.dimension];
      for (const dim of dims) {
        queryParts.push(`dimension=${encodeURIComponent(String(dim))}`);
      }
    }
    if (params.filter) queryParts.push(`filter=${encodeURIComponent(String(params.filter))}`);

    const url = `${baseUrl.replace(/\/+$/, '')}/api/analytics?${queryParts.join('&')}`;

    const response = await this.httpRequest(url, {
      method: 'GET',
      headers,
      timeout: 30_000,
    });

    if (!response.ok) {
      return { records: [], metadata: { error: `DHIS2 analytics returned HTTP ${response.status}` } };
    }

    const body = await response.json() as Record<string, unknown>;
    const analyticsHeaders = (body.headers ?? []) as Array<{ name: string }>;
    const rows = (body.rows ?? []) as string[][];

    // Convert analytics tabular response to records
    const records: Record<string, unknown>[] = rows.map(row => {
      const record: Record<string, unknown> = {};
      analyticsHeaders.forEach((h, i) => {
        record[h.name] = row[i];
      });
      return record;
    });

    return {
      records,
      metadata: { source: 'DHIS2 analytics', headerCount: analyticsHeaders.length },
    };
  }

  // ─── HEALTH CHECK ────────────────────────────────────────────────

  async healthCheck(config: AdapterConfig): Promise<HealthCheckResult> {
    const baseUrl = config.baseUrl;
    if (!baseUrl) {
      return { status: 'DOWN', responseTimeMs: 0, message: 'No DHIS2 base URL configured' };
    }

    const start = Date.now();
    try {
      const url = `${baseUrl.replace(/\/+$/, '')}/api/system/info`;
      const headers = this.buildAuthHeaders(config);
      headers['Accept'] = 'application/json';

      const response = await this.httpRequest(url, {
        method: 'GET',
        headers,
        timeout: 10_000,
      });

      const elapsed = Date.now() - start;

      if (response.ok) {
        const info = await response.json() as Record<string, unknown>;
        return {
          status: 'UP',
          responseTimeMs: elapsed,
          statusCode: response.status,
          message: `DHIS2 ${info.version ?? ''} — ${info.revision ?? ''}`.trim(),
        };
      }

      return {
        status: 'DEGRADED',
        responseTimeMs: elapsed,
        statusCode: response.status,
        message: `DHIS2 returned HTTP ${response.status}`,
      };
    } catch (err: any) {
      const elapsed = Date.now() - start;
      return {
        status: elapsed >= 10_000 ? 'TIMEOUT' : 'DOWN',
        responseTimeMs: elapsed,
        message: `DHIS2 health check failed: ${err.message}`,
      };
    }
  }
}
