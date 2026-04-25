/**
 * widget-resolver.ts — Resolves live data for each widget on a dashboard.
 *
 * For each widget, fetches data according to its dataSource type, caches
 * the result in Redis (5 min TTL keyed by widget id + userId + filters hash).
 */

import { createHash } from 'crypto';
import type { Pool } from 'pg';
import type { RedisClient } from '../services/redis-client';
import type { IndicatorService } from '../indicators/indicator.service';
import type { DashboardService } from './dashboard.service';
import type { RenderQuery } from './dashboard.schemas';

const RESOLVE_CACHE_PREFIX = 'analytics:widget-resolve:';
const RESOLVE_CACHE_TTL = 300; // 5 min

interface ResolvedWidget {
  widgetId: string;
  type: string;
  dataSource: string;
  title: { fr: string; en: string; ar?: string; pt?: string };
  grid: { x: number; y: number; w: number; h: number };
  data: unknown;
  error?: string;
}

export class WidgetResolver {
  private pool: Pool;

  constructor(
    private readonly redis: RedisClient,
    private readonly indicatorService: IndicatorService,
    private readonly dashboardService: DashboardService,
  ) {
    this.pool = indicatorService.getPool();
  }

  /**
   * Render a full dashboard: load all widgets and resolve their data in parallel.
   */
  async renderDashboard(
    dashboardId: string,
    userId: string,
    globalFilters: RenderQuery,
  ): Promise<{ dashboard: Record<string, unknown>; renderedWidgets: ResolvedWidget[] }> {
    const result = await this.dashboardService.getDashboardWithWidgets(dashboardId);
    if (!result) {
      throw Object.assign(new Error('Dashboard not found'), { statusCode: 404 });
    }

    const { dashboard, widgets } = result;

    const renderedWidgets = await Promise.all(
      widgets.map((w) => this.resolveWidget(w, userId, globalFilters)),
    );

    return { dashboard, renderedWidgets };
  }

  /**
   * Resolve a single widget's data based on its dataSource.
   */
  async resolveWidget(
    widget: Record<string, unknown>,
    userId: string,
    globalFilters: RenderQuery,
  ): Promise<ResolvedWidget> {
    const widgetId = widget.id as string;
    const dataSource = widget.data_source as string;
    const config = (typeof widget.config === 'string' ? JSON.parse(widget.config) : widget.config) as Record<string, unknown>;
    const widgetFilters = (typeof widget.filters === 'string' ? JSON.parse(widget.filters) : widget.filters) as Record<string, unknown>;

    const base: Omit<ResolvedWidget, 'data' | 'error'> = {
      widgetId,
      type: widget.type as string,
      dataSource,
      title: {
        fr: widget.title_fr as string,
        en: widget.title_en as string,
        ar: widget.title_ar as string | undefined,
        pt: widget.title_pt as string | undefined,
      },
      grid: {
        x: widget.grid_x as number,
        y: widget.grid_y as number,
        w: widget.grid_w as number,
        h: widget.grid_h as number,
      },
    };

    // Check cache
    const cacheKey = this.buildCacheKey(widgetId, userId, globalFilters);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return { ...base, data: JSON.parse(cached) };
      } catch { /* stale, resolve fresh */ }
    }

    try {
      const data = await this.resolveDataSource(dataSource, config, widgetFilters, globalFilters, userId);
      // Cache the result
      await this.redis.set(cacheKey, JSON.stringify(data), RESOLVE_CACHE_TTL);
      return { ...base, data };
    } catch (err) {
      return { ...base, data: null, error: (err as Error).message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Data source resolvers
  // ═══════════════════════════════════════════════════════════════════════

  private async resolveDataSource(
    dataSource: string,
    config: Record<string, unknown>,
    widgetFilters: Record<string, unknown>,
    globalFilters: RenderQuery,
    userId: string,
  ): Promise<unknown> {
    switch (dataSource) {
      case 'INDICATOR':
        return this.resolveIndicator(config, globalFilters);

      case 'FORM_AGGREGATION':
        return this.resolveFormAggregation(config, globalFilters);

      case 'KPI_CONTINENTAL':
        return this.resolveKpiContinental(config, globalFilters);

      case 'MANUAL_VALUE':
        return this.resolveManualValue(config);

      case 'COMPOSITE':
        return this.resolveComposite(config, globalFilters, userId);

      case 'SQL_QUERY':
        return this.resolveSqlQuery(config, userId);

      default:
        throw new Error(`Unsupported data source: ${dataSource}`);
    }
  }

  /**
   * INDICATOR — look up an indicator by code, get latest value + trend.
   */
  private async resolveIndicator(
    config: Record<string, unknown>,
    globalFilters: RenderQuery,
  ): Promise<unknown> {
    const indicatorCode = config.indicatorCode as string;
    if (!indicatorCode) throw new Error('indicatorCode is required for INDICATOR data source');

    const indicator = await this.indicatorService.getIndicatorByCode(indicatorCode);
    const indicatorObj = indicator as Record<string, unknown>;
    const indicatorId = indicatorObj.id as string;

    const latestValue = await this.indicatorService.getLatestValue(indicatorId);

    // Get history for trend (last 6 values)
    const historyResult = await this.indicatorService.listValues(indicatorId, {
      countryCode: globalFilters.countryCode,
      page: 1,
      limit: 6,
    });

    return {
      indicator: { id: indicatorId, code: indicatorCode, name_en: indicatorObj.name_en, name_fr: indicatorObj.name_fr },
      value: latestValue,
      trend: this.computeTrend(historyResult.data),
      history: historyResult.data,
    };
  }

  /**
   * FORM_AGGREGATION — count/sum/avg submissions for a form.
   */
  private async resolveFormAggregation(
    config: Record<string, unknown>,
    globalFilters: RenderQuery,
  ): Promise<unknown> {
    const formId = config.formId as string;
    const aggregation = (config.aggregation as string) ?? 'count';
    const field = config.field as string | undefined;

    if (!formId) throw new Error('formId is required for FORM_AGGREGATION data source');

    const conditions: string[] = ['s.form_template_id = $1'];
    const params: unknown[] = [formId];
    let idx = 2;

    if (globalFilters.countryCode) {
      conditions.push(`s.country_code = $${idx++}`);
      params.push(globalFilters.countryCode);
    }
    if (globalFilters.year) {
      conditions.push(`EXTRACT(YEAR FROM s.submitted_at) = $${idx++}`);
      params.push(globalFilters.year);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    if (aggregation === 'count') {
      const { rows } = await this.pool.query(
        `SELECT COUNT(*)::int AS value FROM public.form_submissions s ${where}`,
        params,
      );
      return { value: rows[0].value, aggregation: 'count' };
    }

    // For sum/avg we need the field
    if (!field) throw new Error('field is required for sum/avg aggregation');

    const aggFn = aggregation === 'sum' ? 'SUM' : 'AVG';
    const { rows } = await this.pool.query(
      `SELECT ${aggFn}((s.data->>'${field}')::numeric) AS value
       FROM public.form_submissions s ${where}`,
      params,
    );

    return { value: rows[0].value, aggregation, field };
  }

  /**
   * KPI_CONTINENTAL — read from kpi_definitions / country_kpi_scores.
   */
  private async resolveKpiContinental(
    config: Record<string, unknown>,
    globalFilters: RenderQuery,
  ): Promise<unknown> {
    const kpiCode = config.kpiCode as string;
    if (!kpiCode) throw new Error('kpiCode is required for KPI_CONTINENTAL data source');

    const conditions: string[] = ['k.code = $1'];
    const params: unknown[] = [kpiCode];
    let idx = 2;

    // Get definition
    const { rows: defRows } = await this.pool.query(
      `SELECT * FROM analytics.kpi_definitions WHERE code = $1`,
      [kpiCode],
    );

    if (defRows.length === 0) {
      throw new Error(`KPI definition not found: ${kpiCode}`);
    }

    // Get country scores
    const scoreConditions: string[] = ['s.kpi_definition_id = $1'];
    const scoreParams: unknown[] = [defRows[0].id];
    let scoreIdx = 2;

    if (globalFilters.countryCode) {
      scoreConditions.push(`s.country_code = $${scoreIdx++}`);
      scoreParams.push(globalFilters.countryCode);
    }
    if (globalFilters.year) {
      scoreConditions.push(`s.year = $${scoreIdx++}`);
      scoreParams.push(globalFilters.year);
    }

    const { rows: scoreRows } = await this.pool.query(
      `SELECT * FROM analytics.country_kpi_scores s WHERE ${scoreConditions.join(' AND ')} ORDER BY s.year DESC, s.country_code`,
      scoreParams,
    );

    return {
      definition: defRows[0],
      value: scoreRows.length > 0 ? scoreRows[0].score : null,
      byCountry: scoreRows,
    };
  }

  /**
   * MANUAL_VALUE — return a static value from config.
   */
  private resolveManualValue(config: Record<string, unknown>): unknown {
    return { value: config.value ?? null, label: config.label ?? null };
  }

  /**
   * COMPOSITE — evaluate a formula referencing other widgets' resolved data.
   * Uses mathjs-style expression with variable substitution.
   */
  private async resolveComposite(
    config: Record<string, unknown>,
    globalFilters: RenderQuery,
    userId: string,
  ): Promise<unknown> {
    const formula = config.formula as string;
    const referencedWidgetIds = config.referencedWidgetIds as string[] | undefined;

    if (!formula) throw new Error('formula is required for COMPOSITE data source');

    const referencedValues: Record<string, number> = {};

    if (referencedWidgetIds && referencedWidgetIds.length > 0) {
      // Load each referenced widget and resolve it
      for (const refId of referencedWidgetIds) {
        const { rows } = await this.pool.query(
          `SELECT * FROM dashboard_builder.dashboard_widgets WHERE id = $1`,
          [refId],
        );
        if (rows.length > 0) {
          const resolved = await this.resolveWidget(rows[0], userId, globalFilters);
          const data = resolved.data as Record<string, unknown> | null;
          if (data && typeof data.value === 'number') {
            referencedValues[refId] = data.value;
          }
        }
      }
    }

    // Simple formula evaluation (variable substitution + basic math)
    let expression = formula;
    for (const [varId, val] of Object.entries(referencedValues)) {
      expression = expression.replace(new RegExp(varId.replace(/-/g, '\\-'), 'g'), String(val));
    }

    let computedValue: number | null = null;
    try {
      // Safe evaluation: only allow numbers and basic operators
      const sanitized = expression.replace(/[^0-9+\-*/().% ]/g, '');
      if (sanitized.length > 0) {
        computedValue = Function(`"use strict"; return (${sanitized});`)() as number;
      }
    } catch {
      computedValue = null;
    }

    return { value: computedValue, formula, referencedValues };
  }

  /**
   * SQL_QUERY — execute a whitelisted SQL query (admin only).
   */
  private async resolveSqlQuery(
    config: Record<string, unknown>,
    userId: string,
  ): Promise<unknown> {
    const query = config.query as string;
    if (!query) throw new Error('query is required for SQL_QUERY data source');

    // Security: only allow SELECT queries, no DDL/DML
    const normalized = query.trim().toUpperCase();
    if (!normalized.startsWith('SELECT')) {
      throw Object.assign(new Error('Only SELECT queries are allowed'), { statusCode: 403 });
    }

    // Block dangerous keywords
    const blocked = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE', 'CREATE'];
    for (const kw of blocked) {
      if (normalized.includes(kw)) {
        throw Object.assign(new Error(`Blocked keyword in query: ${kw}`), { statusCode: 403 });
      }
    }

    // Limit results
    const limitedQuery = query.includes('LIMIT') ? query : `${query} LIMIT 1000`;
    const { rows } = await this.pool.query(limitedQuery);

    return { rows, rowCount: rows.length };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════════════════════════

  private buildCacheKey(widgetId: string, userId: string, filters: RenderQuery): string {
    const filtersHash = createHash('md5')
      .update(JSON.stringify(filters))
      .digest('hex')
      .substring(0, 8);
    return `${RESOLVE_CACHE_PREFIX}${widgetId}:${userId}:${filtersHash}`;
  }

  private computeTrend(history: unknown[]): number {
    if (!history || history.length < 2) return 0;
    const values = history
      .map((h) => (h as Record<string, unknown>).value as number)
      .filter((v) => typeof v === 'number');
    if (values.length < 2) return 0;
    const current = values[0];
    const previous = values[1];
    if (previous === 0) return 0;
    return Math.round(((current - previous) / Math.abs(previous)) * 100 * 10) / 10;
  }
}
