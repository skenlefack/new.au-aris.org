// ═══════════════════════════════════════════════════════════════════
//  WAHIS Adapter — WOAH (World Organisation for Animal Health)
//  Exports ARIS health events to WAHIS notification format.
//  Supports WOAH_XML and WOAH_JSON export formats.
// ═══════════════════════════════════════════════════════════════════

import { XMLBuilder } from 'fast-xml-parser';
import {
  BaseAdapter,
  type AdapterConfig,
  type FormatBuildResult,
  type DeliveryResult,
  type PullResult,
  type HealthCheckResult,
} from './base.adapter';

const WAHIS_PORTAL_URL = 'https://wahis.woah.org';

export class WahisAdapter extends BaseAdapter {
  readonly systemType = 'WAHIS';
  readonly displayName = 'WAHIS (WOAH)';

  // ─── FORMAT BUILD ────────────────────────────────────────────────

  async formatBuild(
    records: Record<string, unknown>[],
    config: AdapterConfig & Record<string, unknown>,
  ): Promise<FormatBuildResult> {
    const format = (config.format as string) ?? 'WOAH_XML';
    const reportType = (config.report_type as string) ?? 'immediate';
    const reportPeriod = (config.report_period as string) ?? '';
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');

    const notifications = records.map((record, index) =>
      this.buildNotification(record, reportType, reportPeriod, index),
    );

    if (format === 'WOAH_JSON') {
      const payload = {
        'wahis-report': {
          metadata: {
            generated_at: now.toISOString(),
            generator: 'ARIS-InteropHub/1.0',
            report_type: reportType,
            report_period: reportPeriod,
            record_count: notifications.length,
          },
          notifications,
        },
      };

      const data = JSON.stringify(payload, null, 2);
      return {
        format: 'WOAH_JSON',
        data,
        contentType: 'application/json',
        filename: `wahis-${reportType}-${timestamp}.json`,
        recordCount: records.length,
        metadata: { reportType, reportPeriod },
      };
    }

    // Default: WOAH_XML
    const xmlObj = {
      'wahis-report': {
        '@_xmlns': 'urn:woah:wahis:notification:1.0',
        '@_generated': now.toISOString(),
        '@_generator': 'ARIS-InteropHub/1.0',
        metadata: {
          report_type: reportType,
          report_period: reportPeriod,
          record_count: notifications.length,
        },
        notifications: {
          notification: notifications,
        },
      },
    };

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true,
    });
    const xmlContent = builder.build(xmlObj) as string;
    const data = `<?xml version="1.0" encoding="UTF-8"?>\n${xmlContent}`;

    return {
      format: 'WOAH_XML',
      data,
      contentType: 'application/xml',
      filename: `wahis-${reportType}-${timestamp}.xml`,
      recordCount: records.length,
      metadata: { reportType, reportPeriod },
    };
  }

  private buildNotification(
    record: Record<string, unknown>,
    reportType: string,
    reportPeriod: string,
    index: number,
  ): Record<string, unknown> {
    return {
      '@_id': (record.id as string) ?? `aris-${index}`,
      country: {
        iso3: record.country_code ?? record.country_iso3 ?? '',
        name: record.country_name ?? '',
      },
      disease: {
        oie_code: record.disease_code ?? record.oie_code ?? '',
        name: record.disease_name ?? '',
      },
      species: {
        code: record.species_code ?? '',
        name: record.species_name ?? '',
      },
      outbreak: {
        location: record.location_name ?? record.admin1_name ?? '',
        coordinates: {
          latitude: record.latitude ?? record.lat ?? '',
          longitude: record.longitude ?? record.lng ?? '',
        },
        date_suspicion: this.formatDate(record.date_suspicion ?? record.suspected_at),
        date_confirmation: this.formatDate(record.date_confirmation ?? record.confirmed_at),
        date_report: this.formatDate(record.date_report ?? record.reported_at),
        date_closure: this.formatDate(record.date_closure ?? record.closed_at),
      },
      epidemiology: {
        susceptible: record.susceptible ?? record.cases_susceptible ?? 0,
        cases: record.cases ?? record.cases_total ?? 0,
        deaths: record.deaths ?? record.deaths_total ?? 0,
        destroyed: record.destroyed ?? 0,
        slaughtered: record.slaughtered ?? 0,
        vaccinated: record.vaccinated ?? 0,
      },
      control_measures: record.control_measures ?? record.measures ?? [],
      report_type: reportType,
      report_period: reportPeriod,
      source: 'ARIS',
      confidence: record.confidence ?? record.confidence_level ?? 'CONFIRMED',
    };
  }

  // ─── DELIVER ─────────────────────────────────────────────────────

  async deliver(
    formatted: FormatBuildResult,
    config: AdapterConfig,
  ): Promise<DeliveryResult> {
    const url = config.baseUrl;
    if (!url) {
      // No WAHIS endpoint configured — data is stored in MinIO for manual download
      return {
        success: true,
        deliveredAt: new Date(),
        responseBody: 'No WAHIS endpoint configured. Data available for manual download via MinIO.',
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
        error: response.ok ? undefined : `WAHIS returned HTTP ${response.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        deliveredAt: new Date(),
        error: `WAHIS delivery failed: ${err.message}`,
      };
    }
  }

  // ─── PULL ────────────────────────────────────────────────────────

  async pull(
    _config: AdapterConfig,
    _params: Record<string, unknown>,
  ): Promise<PullResult> {
    // WAHIS is outbound-only from ARIS perspective.
    // ARIS pushes TO WAHIS; there is no pull API.
    return {
      records: [],
      metadata: { note: 'WAHIS adapter is outbound-only. ARIS pushes data to WAHIS.' },
    };
  }

  // ─── HEALTH CHECK ────────────────────────────────────────────────

  async healthCheck(config: AdapterConfig): Promise<HealthCheckResult> {
    const url = config.baseUrl ?? WAHIS_PORTAL_URL;
    const start = Date.now();

    try {
      const response = await this.httpRequest(url, {
        method: 'HEAD',
        headers: this.buildAuthHeaders(config),
        timeout: 10_000,
      });

      return {
        status: response.ok ? 'UP' : 'DEGRADED',
        responseTimeMs: Date.now() - start,
        statusCode: response.status,
        message: response.ok ? 'WAHIS portal reachable' : `HTTP ${response.status}`,
      };
    } catch (err: any) {
      const elapsed = Date.now() - start;
      const isTimeout = err.name === 'AbortError' || elapsed >= 10_000;
      return {
        status: isTimeout ? 'TIMEOUT' : 'DOWN',
        responseTimeMs: elapsed,
        message: `WAHIS health check failed: ${err.message}`,
      };
    }
  }
}
