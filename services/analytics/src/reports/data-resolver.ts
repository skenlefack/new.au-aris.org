/**
 * data-resolver.ts — Resolves ARIS data for report sections.
 *
 * Queries indicator_values and related analytics tables to provide
 * data context for AI-generated and data-driven sections.
 */

import { Pool } from 'pg';

export interface SectionConfig {
  sectionType: string;
  indicatorCodes?: string[];
  promptTemplate?: string;
}

export interface ReportContext {
  id: string;
  domainId?: string;
  tenantId?: string;
  scope: string;
  periodStart: string;
  periodEnd: string;
  referenceYear?: number;
  language: string;
}

export interface ResolvedData {
  indicators?: IndicatorRow[];
  countryBreakdown?: CountryRow[];
  trends?: TrendRow[];
  summary?: Record<string, unknown>;
}

interface IndicatorRow {
  code: string;
  name: string;
  value: number;
  unit: string;
  period: string;
  tenantId: string;
  tenantName?: string;
}

interface CountryRow {
  tenantId: string;
  tenantName: string;
  iso3: string;
  values: Record<string, number>;
}

interface TrendRow {
  code: string;
  name: string;
  period: string;
  value: number;
}

export class DataResolver {
  private pool: Pool;

  constructor(databaseUrl?: string) {
    const url =
      databaseUrl ||
      process.env['DATABASE_URL'] ||
      process.env['DIRECT_DATABASE_URL'] ||
      'postgresql://aris:aris@localhost:5432/aris';
    this.pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 30_000 });
  }

  /**
   * Resolve data for a given section based on its type and the report context.
   */
  async resolveStatsForSection(
    sectionConfig: SectionConfig,
    report: ReportContext,
  ): Promise<ResolvedData> {
    switch (sectionConfig.sectionType) {
      case 'INDICATORS_TABLE':
        return this.resolveIndicatorsTable(sectionConfig, report);
      case 'MAP_AND_TABLE':
        return this.resolveMapAndTable(sectionConfig, report);
      case 'AI_GENERATED_FROM_DATA':
        return this.resolveAiDataBasket(sectionConfig, report);
      default:
        return {};
    }
  }

  /**
   * Fetch indicator values for the given codes within the report period.
   */
  private async resolveIndicatorsTable(
    sectionConfig: SectionConfig,
    report: ReportContext,
  ): Promise<ResolvedData> {
    if (!sectionConfig.indicatorCodes?.length) return { indicators: [] };

    try {
      const { rows } = await this.pool.query<IndicatorRow>(
        `SELECT
           i.code,
           COALESCE(i.name_en, i.name_fr) AS name,
           iv.numeric_value AS value,
           COALESCE(i.unit, '') AS unit,
           iv.period,
           iv.tenant_id AS "tenantId"
         FROM analytics.indicator_values iv
         JOIN analytics.indicators i ON i.id = iv.indicator_id
         WHERE i.code = ANY($1)
           AND iv.period >= $2
           AND iv.period <= $3
           ${report.tenantId ? 'AND iv.tenant_id = $4' : ''}
         ORDER BY i.code, iv.period`,
        report.tenantId
          ? [sectionConfig.indicatorCodes, report.periodStart, report.periodEnd, report.tenantId]
          : [sectionConfig.indicatorCodes, report.periodStart, report.periodEnd],
      );
      return { indicators: rows };
    } catch (err) {
      console.error('[DataResolver] Failed to resolve indicators:', err);
      return { indicators: [] };
    }
  }

  /**
   * Break down indicator values by country (tenant) for map/table sections.
   */
  private async resolveMapAndTable(
    sectionConfig: SectionConfig,
    report: ReportContext,
  ): Promise<ResolvedData> {
    if (!sectionConfig.indicatorCodes?.length) return { countryBreakdown: [] };

    try {
      const { rows } = await this.pool.query(
        `SELECT
           iv.tenant_id AS "tenantId",
           COALESCE(t.name_en, t.name_fr, iv.tenant_id::text) AS "tenantName",
           COALESCE(t.iso3, '') AS iso3,
           i.code AS indicator_code,
           iv.numeric_value AS value
         FROM analytics.indicator_values iv
         JOIN analytics.indicators i ON i.id = iv.indicator_id
         LEFT JOIN public.tenants t ON t.id = iv.tenant_id
         WHERE i.code = ANY($1)
           AND iv.period >= $2
           AND iv.period <= $3
         ORDER BY "tenantName", i.code`,
        [sectionConfig.indicatorCodes, report.periodStart, report.periodEnd],
      );

      // Group by tenant
      const map = new Map<string, CountryRow>();
      for (const row of rows) {
        const key = row.tenantId as string;
        if (!map.has(key)) {
          map.set(key, {
            tenantId: key,
            tenantName: row.tenantName as string,
            iso3: row.iso3 as string,
            values: {},
          });
        }
        const entry = map.get(key)!;
        entry.values[row.indicator_code as string] = row.value as number;
      }

      return { countryBreakdown: Array.from(map.values()) };
    } catch (err) {
      console.error('[DataResolver] Failed to resolve map/table:', err);
      return { countryBreakdown: [] };
    }
  }

  /**
   * Build a basket of stats for AI-generated sections:
   * latest indicator values + trend data (year-over-year).
   */
  private async resolveAiDataBasket(
    sectionConfig: SectionConfig,
    report: ReportContext,
  ): Promise<ResolvedData> {
    const indicators = await this.resolveIndicatorsTable(sectionConfig, report);

    // Attempt trend query (previous period comparison)
    let trends: TrendRow[] = [];
    if (sectionConfig.indicatorCodes?.length && report.referenceYear) {
      try {
        const prevYear = report.referenceYear - 1;
        const { rows } = await this.pool.query<TrendRow>(
          `SELECT
             i.code,
             COALESCE(i.name_en, i.name_fr) AS name,
             iv.period,
             iv.numeric_value AS value
           FROM analytics.indicator_values iv
           JOIN analytics.indicators i ON i.id = iv.indicator_id
           WHERE i.code = ANY($1)
             AND EXTRACT(YEAR FROM iv.period::date) IN ($2, $3)
             ${report.tenantId ? 'AND iv.tenant_id = $4' : ''}
           ORDER BY i.code, iv.period`,
          report.tenantId
            ? [sectionConfig.indicatorCodes, prevYear, report.referenceYear, report.tenantId]
            : [sectionConfig.indicatorCodes, prevYear, report.referenceYear],
        );
        trends = rows;
      } catch (err) {
        console.error('[DataResolver] Failed to resolve trends:', err);
      }
    }

    // Summary stats
    const summary: Record<string, unknown> = {
      totalIndicators: indicators.indicators?.length ?? 0,
      period: `${report.periodStart} to ${report.periodEnd}`,
      scope: report.scope,
    };

    return {
      indicators: indicators.indicators,
      trends,
      summary,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
