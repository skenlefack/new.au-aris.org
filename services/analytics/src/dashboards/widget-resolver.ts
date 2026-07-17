/**
 * widget-resolver.ts — Resolves live data for each widget on a dashboard.
 *
 * For each widget, fetches data according to its dataSource type, caches
 * the result in Redis (5 min TTL keyed by widget id + userId + filters hash).
 */

import { createHash } from 'crypto';
import { create, all } from 'mathjs';
import type { Pool } from 'pg';
import type { RedisClient } from '../services/redis-client';
import type { IndicatorService } from '../indicators/indicator.service';
import type { DashboardService } from './dashboard.service';
import type { RenderQuery } from './dashboard.schemas';

const math = create(all);

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

      case 'ANALYTICS_QUERY':
        return this.resolveAnalyticsQuery(config, globalFilters);

      default:
        throw new Error(`Unsupported data source: ${dataSource}`);
    }
  }

  /**
   * INDICATOR — look up an indicator by code, get latest value + trend.
   * Also supports indicatorCode from config.indicatorCode or config.kpiCode (fallback).
   */
  private async resolveIndicator(
    config: Record<string, unknown>,
    globalFilters: RenderQuery,
  ): Promise<unknown> {
    const indicatorCode = (config.indicatorCode as string) || (config.kpiCode as string);
    if (!indicatorCode) throw new Error('indicatorCode is required for INDICATOR data source');

    let indicator: unknown;
    try {
      indicator = await this.indicatorService.getIndicatorByCode(indicatorCode);
    } catch {
      // Try with dashes replaced by underscores and vice versa
      const altCode = indicatorCode.includes('-')
        ? indicatorCode.replace(/-/g, '_')
        : indicatorCode.replace(/_/g, '-');
      try {
        indicator = await this.indicatorService.getIndicatorByCode(altCode);
      } catch {
        return { indicator: { code: indicatorCode }, value: null, trend: null, history: [], error: `Indicator not found: ${indicatorCode}` };
      }
    }

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
      indicator: { id: indicatorId, code: indicatorObj.code ?? indicatorCode, name_en: indicatorObj.name_en, name_fr: indicatorObj.name_fr, unit: indicatorObj.unit },
      value: latestValue,
      trend: this.computeTrend(historyResult.data),
      history: historyResult.data,
    };
  }

  /**
   * FORM_AGGREGATION — count/sum/avg submissions for a form.
   * Enhanced: supports groupBy (country, month, year, field) for charts.
   */
  private async resolveFormAggregation(
    config: Record<string, unknown>,
    globalFilters: RenderQuery,
  ): Promise<unknown> {
    const formId = config.formId as string;
    const aggregation = (config.aggregation as string) ?? 'count';
    const field = config.field as string | undefined;
    const groupBy = config.groupBy as string | undefined;
    const sortBy = (config.sortBy as string) ?? 'value';
    const sortOrder = (config.sortOrder as string) ?? 'desc';
    const limit = (config.limit as number) ?? 50;

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
    if (globalFilters.dateFrom) {
      conditions.push(`s.submitted_at >= $${idx++}::date`);
      params.push(globalFilters.dateFrom);
    }
    if (globalFilters.dateTo) {
      conditions.push(`s.submitted_at <= $${idx++}::date`);
      params.push(globalFilters.dateTo);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // ── Grouped aggregation (returns array for charts) ──
    if (groupBy) {
      let groupColumn: string;
      let nameColumn: string;
      switch (groupBy) {
        case 'country':
          groupColumn = 's.country_code';
          nameColumn = 's.country_code';
          break;
        case 'month':
          groupColumn = "to_char(s.submitted_at, 'YYYY-MM')";
          nameColumn = "to_char(s.submitted_at, 'YYYY-MM')";
          break;
        case 'year':
          groupColumn = 'EXTRACT(YEAR FROM s.submitted_at)::int';
          nameColumn = 'EXTRACT(YEAR FROM s.submitted_at)::int';
          break;
        case 'quarter':
          groupColumn = "to_char(s.submitted_at, 'YYYY-\"Q\"Q')";
          nameColumn = "to_char(s.submitted_at, 'YYYY-\"Q\"Q')";
          break;
        case 'week':
          groupColumn = "to_char(s.submitted_at, 'IYYY-IW')";
          nameColumn = "to_char(s.submitted_at, 'IYYY-IW')";
          break;
        default:
          // Group by a data field value: s.data->>'fieldName'
          groupColumn = `s.data->>'${groupBy.replace(/'/g, "''")}'`;
          nameColumn = groupColumn;
          break;
      }

      const aggExpr = aggregation === 'count'
        ? 'COUNT(*)::int'
        : field
          ? `${aggregation === 'sum' ? 'SUM' : aggregation === 'avg' ? 'AVG' : aggregation === 'min' ? 'MIN' : 'MAX'}((s.data->>'${field.replace(/'/g, "''")}')::numeric)`
          : 'COUNT(*)::int';

      const orderCol = sortBy === 'name' ? 'name' : 'value';
      const { rows } = await this.pool.query(
        `SELECT ${nameColumn}::text AS name, ${groupColumn}::text AS key, ${aggExpr} AS value
         FROM public.form_submissions s ${where}
         GROUP BY ${groupColumn}, ${nameColumn}
         ORDER BY ${orderCol} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}
         LIMIT $${idx}`,
        [...params, limit],
      );

      return { data: rows, aggregation, groupBy, field: field || null, total: rows.length };
    }

    // ── Single value aggregation (original behavior) ──
    if (aggregation === 'count') {
      const { rows } = await this.pool.query(
        `SELECT COUNT(*)::int AS value FROM public.form_submissions s ${where}`,
        params,
      );
      return { value: rows[0].value, aggregation: 'count' };
    }

    if (!field) throw new Error('field is required for sum/avg aggregation');

    const aggFn = aggregation === 'sum' ? 'SUM' : aggregation === 'avg' ? 'AVG' : aggregation === 'min' ? 'MIN' : 'MAX';
    const { rows } = await this.pool.query(
      `SELECT ${aggFn}((s.data->>'${field.replace(/'/g, "''")}')::numeric) AS value
       FROM public.form_submissions s ${where}`,
      params,
    );

    return { value: rows[0].value, aggregation, field };
  }

  /**
   * KPI_CONTINENTAL — read from kpi_definitions / country_kpi_scores,
   * or fall back to indicator_values aggregation by domain/country.
   */
  private async resolveKpiContinental(
    config: Record<string, unknown>,
    globalFilters: RenderQuery,
  ): Promise<unknown> {
    const kpiCode = config.kpiCode as string | undefined;
    const domain = config.domain as string | undefined;
    const metric = config.metric as string | undefined;
    const groupBy = config.groupBy as string | undefined;
    const limit = (config.limit as number) ?? 20;

    // ── Path A: KPI code provided → original flow via kpi_definitions ──
    if (kpiCode) {
      const { rows: defRows } = await this.pool.query(
        `SELECT * FROM analytics.kpi_definitions WHERE code = $1`,
        [kpiCode],
      );

      if (defRows.length === 0) {
        throw new Error(`KPI definition not found: ${kpiCode}`);
      }

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

    // ── Path B: Domain-based aggregation from indicator_values ──
    if (domain) {
      // Resolve domain UUID
      const { rows: domRows } = await this.pool.query(
        `SELECT id FROM governance.domains WHERE code = $1 LIMIT 1`,
        [domain],
      );
      const domainId = domRows.length > 0 ? domRows[0].id : null;

      if (!domainId) {
        return { data: [], byCountry: [], message: `Domain not found: ${domain}` };
      }

      // Get indicator values grouped by country for this domain
      const yearFilter = globalFilters.year ?? new Date().getFullYear();
      const conditions: string[] = [
        'i.domain_id = $1',
        'i.active = true',
        'iv.year = $2',
        'iv.country_code IS NOT NULL',
        'iv.is_continental = false',
      ];
      const params: unknown[] = [domainId, yearFilter];
      let idx = 3;

      if (globalFilters.countryCode) {
        conditions.push(`iv.country_code = $${idx++}`);
        params.push(globalFilters.countryCode);
      }

      // Determine grouping based on config
      let groupColumn = 'iv.country_code';
      let nameColumn = 'iv.country_code';
      if (groupBy === 'rec') {
        groupColumn = 'iv.rec_code';
        nameColumn = 'iv.rec_code';
        // Replace country_code filter with rec filter
        const cIdx = conditions.indexOf('iv.country_code IS NOT NULL');
        if (cIdx >= 0) conditions[cIdx] = 'iv.rec_code IS NOT NULL';
      } else if (groupBy === 'disease' || groupBy === 'species') {
        // Group by indicator code instead (each indicator = one disease/species)
        groupColumn = 'i.code';
        nameColumn = 'i.name_en';
      }

      const { rows } = await this.pool.query(
        `SELECT ${nameColumn} as name, ${groupColumn} as key,
                SUM(iv.value)::float as value, COUNT(*)::int as count
         FROM analytics.indicator_values iv
         JOIN analytics.indicators i ON i.id = iv.indicator_id
         WHERE ${conditions.join(' AND ')}
         GROUP BY ${groupColumn}, ${nameColumn}
         ORDER BY value DESC
         LIMIT $${idx}`,
        [...params, limit],
      );

      // Also get time series (last 12 months or years)
      const { rows: trendRows } = await this.pool.query(
        `SELECT iv.year, iv.month, SUM(iv.value)::float as value
         FROM analytics.indicator_values iv
         JOIN analytics.indicators i ON i.id = iv.indicator_id
         WHERE i.domain_id = $1 AND i.active = true AND iv.is_continental = true
           AND iv.year >= $2
         GROUP BY iv.year, iv.month
         ORDER BY iv.year, iv.month
         LIMIT 24`,
        [domainId, yearFilter - 2],
      );

      return {
        data: rows,
        byCountry: rows.filter((r: any) => r.key?.length === 2), // ISO country codes
        trend: trendRows,
        domain,
        year: yearFilter,
        groupBy: groupBy || 'country',
      };
    }

    // ── Path C: Neither kpiCode nor domain → error ──
    throw new Error('kpiCode or domain is required for KPI_CONTINENTAL data source');
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
      // Safe evaluation via mathjs — only allow numbers and basic operators
      const sanitizedExpression = expression.replace(/[^0-9+\-*/().% ]/g, '');
      if (sanitizedExpression.length > 0) {
        const result = math.evaluate(sanitizedExpression);
        computedValue = typeof result === 'number' ? result : Number(result);
        if (isNaN(computedValue)) computedValue = null;
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
  //  ANALYTICS_QUERY — Structured query against datalake/domain tables
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * ANALYTICS_QUERY — Powerful structured queries for dashboard widgets.
   *
   * Config shape:
   *   queryType: 'submissions_by_country' | 'submissions_by_domain' | 'submissions_timeline'
   *              | 'domain_kpis' | 'continental_summary' | 'form_field_distribution'
   *              | 'form_time_series' | 'historical_aggregate' | 'cross_domain_comparison'
   *   domain:    optional domain code filter (e.g. 'animal-health', 'livestock-prod')
   *   groupBy:   'country' | 'domain' | 'month' | 'year' | 'quarter' | 'week' | 'status' | 'rec'
   *   metric:    'count' | 'sum' | 'avg' | 'min' | 'max'
   *   field:     JSON field path for metric (when metric != 'count')
   *   filters:   { countryCode?, dateFrom?, dateTo?, status?, formId? }
   *   sort:      'value_desc' | 'value_asc' | 'name_asc' | 'name_desc'
   *   limit:     max rows (default 50)
   *   // For charts: field mapping hints
   *   xKey:      field name for X axis (auto-detected from groupBy if omitted)
   *   yKey:      field name for Y axis (defaults to 'value')
   *   seriesKey: field for multi-series split
   */
  private async resolveAnalyticsQuery(
    config: Record<string, unknown>,
    globalFilters: RenderQuery,
  ): Promise<unknown> {
    const queryType = config.queryType as string;
    if (!queryType) throw new Error('queryType is required for ANALYTICS_QUERY');

    const domain = (config.domain as string) || globalFilters.domainCode || undefined;
    const groupBy = (config.groupBy as string) || 'country';
    const metric = (config.metric as string) || 'count';
    const field = config.field as string | undefined;
    const sort = (config.sort as string) || 'value_desc';
    const limit = Math.min((config.limit as number) || 50, 500);
    const localFilters = (config.filters as Record<string, unknown>) || {};

    // Merge global + local filters
    const countryCode = (localFilters.countryCode as string) || globalFilters.countryCode;
    const recCode = (localFilters.recCode as string) || globalFilters.recCode;
    const dateFrom = (localFilters.dateFrom as string) || globalFilters.dateFrom;
    const dateTo = (localFilters.dateTo as string) || globalFilters.dateTo;
    const year = (localFilters.year as number) || globalFilters.year;
    const formId = localFilters.formId as string | undefined;
    const status = localFilters.status as string | undefined;

    switch (queryType) {
      case 'submissions_by_country':
        return this.aqSubmissionsByCountry(domain, countryCode, dateFrom, dateTo, year, limit, sort);

      case 'submissions_by_domain':
        return this.aqSubmissionsByDomain(countryCode, dateFrom, dateTo, year, limit);

      case 'submissions_timeline':
        return this.aqSubmissionsTimeline(domain, groupBy, countryCode, dateFrom, dateTo, year, limit);

      case 'domain_kpis':
        return this.aqDomainKpis(domain, countryCode, year);

      case 'continental_summary':
        return this.aqContinentalSummary(year);

      case 'form_field_distribution':
        return this.aqFormFieldDistribution(formId!, field!, metric, groupBy, countryCode, dateFrom, dateTo, limit, sort);

      case 'form_time_series':
        return this.aqFormTimeSeries(formId!, field, metric, groupBy, countryCode, dateFrom, dateTo, limit);

      case 'historical_aggregate':
        return this.aqHistoricalAggregate(domain, groupBy, metric, field, countryCode, recCode, dateFrom, dateTo, limit, sort);

      case 'cross_domain_comparison':
        return this.aqCrossDomainComparison(countryCode, year, limit);

      default:
        throw new Error(`Unknown queryType: ${queryType}`);
    }
  }

  /** Submissions count grouped by country */
  private async aqSubmissionsByCountry(
    domain: string | undefined, countryCode: string | undefined,
    dateFrom: string | undefined, dateTo: string | undefined,
    year: number | undefined, limit: number, sort: string,
  ) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (domain) { conditions.push(`ft.domain = $${idx++}`); params.push(domain); }
    if (countryCode) { conditions.push(`s.country_code = $${idx++}`); params.push(countryCode); }
    if (year) { conditions.push(`EXTRACT(YEAR FROM s.submitted_at) = $${idx++}`); params.push(year); }
    if (dateFrom) { conditions.push(`s.submitted_at >= $${idx++}::date`); params.push(dateFrom); }
    if (dateTo) { conditions.push(`s.submitted_at <= $${idx++}::date`); params.push(dateTo); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderDir = sort.includes('asc') ? 'ASC' : 'DESC';
    const orderCol = sort.startsWith('name') ? 's.country_code' : 'value';

    const { rows } = await this.pool.query(
      `SELECT s.country_code AS name, s.country_code AS key, COUNT(*)::int AS value
       FROM public.form_submissions s
       LEFT JOIN form_builder.form_templates ft ON ft.id = s.form_template_id
       ${where}
       GROUP BY s.country_code
       ORDER BY ${orderCol} ${orderDir}
       LIMIT $${idx}`,
      [...params, limit],
    );
    return { data: rows, queryType: 'submissions_by_country', xKey: 'name', yKey: 'value' };
  }

  /** Submissions count grouped by domain */
  private async aqSubmissionsByDomain(
    countryCode: string | undefined,
    dateFrom: string | undefined, dateTo: string | undefined,
    year: number | undefined, limit: number,
  ) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (countryCode) { conditions.push(`s.country_code = $${idx++}`); params.push(countryCode); }
    if (year) { conditions.push(`EXTRACT(YEAR FROM s.submitted_at) = $${idx++}`); params.push(year); }
    if (dateFrom) { conditions.push(`s.submitted_at >= $${idx++}::date`); params.push(dateFrom); }
    if (dateTo) { conditions.push(`s.submitted_at <= $${idx++}::date`); params.push(dateTo); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT COALESCE(ft.domain, 'unknown') AS name, COALESCE(ft.domain, 'unknown') AS key, COUNT(*)::int AS value
       FROM public.form_submissions s
       LEFT JOIN form_builder.form_templates ft ON ft.id = s.form_template_id
       ${where}
       GROUP BY ft.domain
       ORDER BY value DESC
       LIMIT $${idx}`,
      [...params, limit],
    );
    return { data: rows, queryType: 'submissions_by_domain', xKey: 'name', yKey: 'value' };
  }

  /** Submissions over time (month, week, quarter, year) */
  private async aqSubmissionsTimeline(
    domain: string | undefined, groupBy: string,
    countryCode: string | undefined,
    dateFrom: string | undefined, dateTo: string | undefined,
    year: number | undefined, limit: number,
  ) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (domain) { conditions.push(`ft.domain = $${idx++}`); params.push(domain); }
    if (countryCode) { conditions.push(`s.country_code = $${idx++}`); params.push(countryCode); }
    if (year) { conditions.push(`EXTRACT(YEAR FROM s.submitted_at) = $${idx++}`); params.push(year); }
    if (dateFrom) { conditions.push(`s.submitted_at >= $${idx++}::date`); params.push(dateFrom); }
    if (dateTo) { conditions.push(`s.submitted_at <= $${idx++}::date`); params.push(dateTo); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let timeExpr: string;
    switch (groupBy) {
      case 'week':   timeExpr = "to_char(s.submitted_at, 'IYYY-IW')"; break;
      case 'quarter': timeExpr = "to_char(s.submitted_at, 'YYYY-\"Q\"Q')"; break;
      case 'year':   timeExpr = 'EXTRACT(YEAR FROM s.submitted_at)::int'; break;
      default:       timeExpr = "to_char(s.submitted_at, 'YYYY-MM')"; break;
    }

    const { rows } = await this.pool.query(
      `SELECT ${timeExpr}::text AS name, ${timeExpr}::text AS key, COUNT(*)::int AS value
       FROM public.form_submissions s
       LEFT JOIN form_builder.form_templates ft ON ft.id = s.form_template_id
       ${where}
       GROUP BY ${timeExpr}
       ORDER BY name ASC
       LIMIT $${idx}`,
      [...params, limit],
    );
    return { data: rows, queryType: 'submissions_timeline', xKey: 'name', yKey: 'value', groupBy };
  }

  /** Domain-specific KPIs from indicator_values */
  private async aqDomainKpis(
    domain: string | undefined, countryCode: string | undefined, year: number | undefined,
  ) {
    if (!domain) throw new Error('domain is required for domain_kpis queryType');

    const yearFilter = year ?? new Date().getFullYear();
    const conditions = ['i.active = true', 'iv.year = $2'];
    const params: unknown[] = [domain, yearFilter];
    let idx = 3;

    if (countryCode) {
      conditions.push(`iv.country_code = $${idx++}`);
      params.push(countryCode);
    }

    // Resolve domain UUID from code
    const { rows: domRows } = await this.pool.query(
      `SELECT id FROM governance.domains WHERE code = $1 LIMIT 1`, [domain],
    );
    if (domRows.length === 0) {
      return { data: [], queryType: 'domain_kpis', message: `Domain not found: ${domain}` };
    }
    params[0] = domRows[0].id;
    conditions.unshift('i.domain_id = $1');

    const { rows } = await this.pool.query(
      `SELECT i.code AS name, i.name_en AS label, i.name_fr AS label_fr, i.unit,
              SUM(iv.value)::float AS value, COUNT(*)::int AS count
       FROM analytics.indicator_values iv
       JOIN analytics.indicators i ON i.id = iv.indicator_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY i.code, i.name_en, i.name_fr, i.unit
       ORDER BY value DESC
       LIMIT 30`,
      params,
    );
    return { data: rows, queryType: 'domain_kpis', xKey: 'name', yKey: 'value', domain };
  }

  /** Continental summary: total submissions, countries, domains */
  private async aqContinentalSummary(year: number | undefined) {
    const yearFilter = year ?? new Date().getFullYear();

    const { rows } = await this.pool.query(`
      SELECT
        COUNT(*)::int AS total_submissions,
        COUNT(DISTINCT s.country_code)::int AS active_countries,
        COUNT(DISTINCT ft.domain)::int AS active_domains,
        COUNT(DISTINCT s.form_template_id)::int AS active_forms
      FROM public.form_submissions s
      LEFT JOIN form_builder.form_templates ft ON ft.id = s.form_template_id
      WHERE EXTRACT(YEAR FROM s.submitted_at) = $1
    `, [yearFilter]);

    // Also get per-domain breakdown
    const { rows: domainRows } = await this.pool.query(`
      SELECT COALESCE(ft.domain, 'unknown') AS domain, COUNT(*)::int AS count
      FROM public.form_submissions s
      LEFT JOIN form_builder.form_templates ft ON ft.id = s.form_template_id
      WHERE EXTRACT(YEAR FROM s.submitted_at) = $1
      GROUP BY ft.domain ORDER BY count DESC
    `, [yearFilter]);

    return {
      ...rows[0],
      domainBreakdown: domainRows,
      queryType: 'continental_summary',
      year: yearFilter,
    };
  }

  /** Distribution of a form field's values (for pie/bar charts) */
  private async aqFormFieldDistribution(
    formId: string, field: string, metric: string, groupBy: string,
    countryCode: string | undefined,
    dateFrom: string | undefined, dateTo: string | undefined,
    limit: number, sort: string,
  ) {
    if (!formId) throw new Error('formId required for form_field_distribution');
    if (!field) throw new Error('field required for form_field_distribution');

    const conditions: string[] = ['s.form_template_id = $1'];
    const params: unknown[] = [formId];
    let idx = 2;

    if (countryCode) { conditions.push(`s.country_code = $${idx++}`); params.push(countryCode); }
    if (dateFrom) { conditions.push(`s.submitted_at >= $${idx++}::date`); params.push(dateFrom); }
    if (dateTo) { conditions.push(`s.submitted_at <= $${idx++}::date`); params.push(dateTo); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const fieldExpr = `s.data->>'${field.replace(/'/g, "''")}'`;

    const aggExpr = metric === 'count' ? 'COUNT(*)::int' : `${metric.toUpperCase()}((${fieldExpr})::numeric)`;
    const groupExpr = groupBy === 'country' ? 's.country_code' : fieldExpr;
    const orderDir = sort.includes('asc') ? 'ASC' : 'DESC';

    const { rows } = await this.pool.query(
      `SELECT ${groupExpr}::text AS name, ${groupExpr}::text AS key, ${aggExpr} AS value
       FROM public.form_submissions s ${where}
       GROUP BY ${groupExpr}
       ORDER BY value ${orderDir}
       LIMIT $${idx}`,
      [...params, limit],
    );
    return { data: rows, queryType: 'form_field_distribution', xKey: 'name', yKey: 'value', field };
  }

  /** Form data as time series (for line/area charts) */
  private async aqFormTimeSeries(
    formId: string, field: string | undefined, metric: string, groupBy: string,
    countryCode: string | undefined,
    dateFrom: string | undefined, dateTo: string | undefined,
    limit: number,
  ) {
    if (!formId) throw new Error('formId required for form_time_series');

    const conditions: string[] = ['s.form_template_id = $1'];
    const params: unknown[] = [formId];
    let idx = 2;

    if (countryCode) { conditions.push(`s.country_code = $${idx++}`); params.push(countryCode); }
    if (dateFrom) { conditions.push(`s.submitted_at >= $${idx++}::date`); params.push(dateFrom); }
    if (dateTo) { conditions.push(`s.submitted_at <= $${idx++}::date`); params.push(dateTo); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    let timeExpr: string;
    switch (groupBy) {
      case 'week':    timeExpr = "to_char(s.submitted_at, 'IYYY-IW')"; break;
      case 'quarter': timeExpr = "to_char(s.submitted_at, 'YYYY-\"Q\"Q')"; break;
      case 'year':    timeExpr = 'EXTRACT(YEAR FROM s.submitted_at)::int'; break;
      default:        timeExpr = "to_char(s.submitted_at, 'YYYY-MM')"; break;
    }

    const aggExpr = metric === 'count' || !field
      ? 'COUNT(*)::int'
      : `${metric.toUpperCase()}((s.data->>'${field.replace(/'/g, "''")}')::numeric)`;

    const { rows } = await this.pool.query(
      `SELECT ${timeExpr}::text AS name, ${timeExpr}::text AS key, ${aggExpr} AS value
       FROM public.form_submissions s ${where}
       GROUP BY ${timeExpr}
       ORDER BY name ASC
       LIMIT $${idx}`,
      [...params, limit],
    );
    return { data: rows, queryType: 'form_time_series', xKey: 'name', yKey: 'value', groupBy };
  }

  /** Historical dataset aggregate (from datalake.historical schema) */
  private async aqHistoricalAggregate(
    domain: string | undefined, groupBy: string, metric: string, field: string | undefined,
    countryCode: string | undefined, recCode: string | undefined,
    dateFrom: string | undefined, dateTo: string | undefined,
    limit: number, sort: string,
  ) {
    // Query historical_datasets to find relevant tables
    const conditions: string[] = ["hd.status = 'READY'"];
    const params: unknown[] = [];
    let idx = 1;

    if (domain) { conditions.push(`hd.domain = $${idx++}`); params.push(domain); }

    const { rows: datasets } = await this.pool.query(
      `SELECT hd.id, hd.table_name, hd.domain, hd.name
       FROM datalake.historical_datasets hd
       WHERE ${conditions.join(' AND ')}
       ORDER BY hd.created_at DESC LIMIT 10`,
      params,
    );

    if (datasets.length === 0) {
      return { data: [], queryType: 'historical_aggregate', message: 'No historical datasets found' };
    }

    // Query across the first matching dataset's table
    const tableName = datasets[0].table_name;
    // Verify table exists and get columns
    const { rows: colRows } = await this.pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'historical' AND table_name = $1`,
      [tableName],
    );
    const columns = colRows.map((r: any) => r.column_name);

    if (columns.length === 0) {
      return { data: [], queryType: 'historical_aggregate', message: `Table historical.${tableName} not found` };
    }

    // Build query based on available columns
    const hasCountry = columns.includes('admin_location') || columns.includes('country') || columns.includes('country_code');
    const countryCol = columns.includes('country_code') ? 'country_code' : columns.includes('country') ? 'country' : 'admin_location';

    let groupCol = countryCol;
    if (groupBy === 'year' && columns.includes('year')) groupCol = 'year';
    else if (groupBy === 'month' && columns.includes('month')) groupCol = 'month';
    else if (groupBy === 'disease' && columns.includes('disease')) groupCol = 'disease';
    else if (groupBy === 'species' && columns.includes('species')) groupCol = 'species';

    const filterConds: string[] = [];
    const fParams: unknown[] = [];
    let fIdx = 1;
    if (countryCode && hasCountry) {
      filterConds.push(`${countryCol} = $${fIdx++}`);
      fParams.push(countryCode);
    }

    const fWhere = filterConds.length > 0 ? `WHERE ${filterConds.join(' AND ')}` : '';
    const aggExpr = metric === 'count' ? 'COUNT(*)::int' :
      field && columns.includes(field) ? `${metric.toUpperCase()}(${field}::numeric)` : 'COUNT(*)::int';
    const orderDir = sort.includes('asc') ? 'ASC' : 'DESC';

    const { rows } = await this.pool.query(
      `SELECT ${groupCol}::text AS name, ${groupCol}::text AS key, ${aggExpr} AS value
       FROM historical."${tableName}" ${fWhere}
       GROUP BY ${groupCol}
       ORDER BY value ${orderDir}
       LIMIT $${fIdx}`,
      [...fParams, limit],
    );

    return {
      data: rows,
      queryType: 'historical_aggregate',
      dataset: { id: datasets[0].id, name: datasets[0].name, domain: datasets[0].domain },
      xKey: 'name', yKey: 'value', groupBy,
    };
  }

  /** Cross-domain comparison: submissions per domain for a country */
  private async aqCrossDomainComparison(
    countryCode: string | undefined, year: number | undefined, limit: number,
  ) {
    const yearFilter = year ?? new Date().getFullYear();
    const conditions: string[] = ['EXTRACT(YEAR FROM s.submitted_at) = $1'];
    const params: unknown[] = [yearFilter];
    let idx = 2;

    if (countryCode) { conditions.push(`s.country_code = $${idx++}`); params.push(countryCode); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const { rows } = await this.pool.query(
      `SELECT COALESCE(ft.domain, 'unknown') AS name,
              COALESCE(ft.domain, 'unknown') AS key,
              COUNT(*)::int AS value,
              COUNT(DISTINCT s.country_code)::int AS countries
       FROM public.form_submissions s
       LEFT JOIN form_builder.form_templates ft ON ft.id = s.form_template_id
       ${where}
       GROUP BY ft.domain
       ORDER BY value DESC
       LIMIT $${idx}`,
      [...params, limit],
    );
    return { data: rows, queryType: 'cross_domain_comparison', xKey: 'name', yKey: 'value', year: yearFilter };
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
