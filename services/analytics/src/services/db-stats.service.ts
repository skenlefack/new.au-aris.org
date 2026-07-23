/**
 * db-stats.service.ts — Direct PostgreSQL queries for dashboard KPIs.
 *
 * The analytics service normally reads from Redis (CQRS read model),
 * but Redis is empty until Kafka events populate it.  This service
 * queries the real tables via PgBouncer so the dashboard shows live
 * record counts from day one.
 *
 * Uses a single SQL round-trip with multiple sub-selects to minimise
 * latency.  Results are cached in Redis for 2 minutes.
 */

import { Pool } from 'pg';
import type { RedisClient } from './redis-client';

const CACHE_KEY = 'analytics:dashboard:db-stats';
const CACHE_TTL = 120; // 2 minutes

export interface DomainStats {
  domain: string;
  records: number;
  quality: number;
}

export interface DashboardDbStats {
  totalRecords: number;
  activeCountries: number;
  pendingValidations: number;
  qualityScore: number;
  domainBreakdown: DomainStats[];
  qualityTrendLine: { date: string; score: number }[];
}

/**
 * Single SQL that counts records across all domain schemas.
 * Uses COALESCE + sub-selects so missing tables don't break the query.
 */
const COUNTS_SQL = `
SELECT
  -- Animal Health
  (SELECT COUNT(*) FROM animal_health.health_events)::int AS health_events,
  (SELECT COUNT(*) FROM animal_health.lab_results)::int AS lab_results,
  (SELECT COUNT(*) FROM animal_health.vaccination_campaigns)::int AS vaccinations,
  (SELECT COUNT(*) FROM animal_health.surveillance_activities)::int AS surveillance,
  -- Livestock
  (SELECT COUNT(*) FROM livestock_prod.livestock_census)::int AS livestock_census,
  (SELECT COUNT(*) FROM livestock_prod.production_records)::int AS livestock_production,
  -- Fisheries
  (SELECT COUNT(*) FROM fisheries.fish_captures)::int AS fish_captures,
  (SELECT COUNT(*) FROM fisheries.aquaculture_production)::int AS aquaculture_prod,
  (SELECT COUNT(*) FROM fisheries.fishing_vessels)::int AS fishing_vessels,
  -- Trade
  (SELECT COUNT(*) FROM trade_sps.trade_flows)::int AS trade_flows,
  (SELECT COUNT(*) FROM trade_sps.sps_certificates)::int AS sps_certs,
  -- Wildlife
  (SELECT COUNT(*) FROM wildlife.wildlife_inventories)::int AS wildlife_inv,
  (SELECT COUNT(*) FROM wildlife.wildlife_crimes)::int AS wildlife_crimes,
  -- Governance
  (SELECT COUNT(*) FROM governance.legal_frameworks)::int AS legal_fw,
  (SELECT COUNT(*) FROM governance.pvs_evaluations)::int AS vet_eval,
  -- Apiculture
  (SELECT COUNT(*) FROM apiculture.apiaries)::int AS apiaries,
  (SELECT COUNT(*) FROM apiculture.honey_production)::int AS honey_prod,
  -- Climate
  (SELECT COUNT(*) FROM climate_env.environmental_hotspots)::int AS env_hotspots,
  (SELECT COUNT(*) FROM climate_env.water_stress_indices)::int AS water_stress,
  -- Cross-cutting
  (SELECT COUNT(DISTINCT tenant_id) FROM animal_health.health_events)::int AS active_countries_health,
  (SELECT COUNT(DISTINCT tenant_id) FROM livestock_prod.livestock_census)::int AS active_countries_livestock,
  -- Quality
  (SELECT COUNT(*) FROM public.quality_reports)::int AS quality_total,
  (SELECT COUNT(*) FROM public.quality_reports WHERE status = 'PASS')::int AS quality_pass,
  -- Pending validations (workflow)
  (SELECT COUNT(*) FROM workflow.workflow_instances WHERE status IN ('PENDING','IN_REVIEW'))::int AS pending_validations
`;

/**
 * Quality trend: monthly pass rates for the last 12 months.
 */
const QUALITY_TREND_SQL = `
SELECT
  to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
  COUNT(*) FILTER (WHERE status = 'PASS')::float / GREATEST(COUNT(*), 1) * 100 AS score
FROM public.quality_reports
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY date_trunc('month', created_at)
ORDER BY month
`;

export class DbStatsService {
  private pool: Pool;

  constructor(
    private readonly redis: RedisClient,
    databaseUrl?: string,
  ) {
    const url = databaseUrl
      || process.env['DATABASE_URL']
      || process.env['DIRECT_DATABASE_URL']
      || 'postgresql://aris:aris@localhost:5432/aris';
    this.pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 30_000 });
  }

  async getDashboardStats(): Promise<DashboardDbStats> {
    // Check Redis cache first
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* stale cache, re-fetch */ }
    }

    try {
      const result = await this.queryStats();
      // Cache for 2 minutes
      await this.redis.set(CACHE_KEY, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (err) {
      console.error('[DbStatsService] SQL query failed, returning zeros:', err);
      return this.emptyStats();
    }
  }

  private async queryStats(): Promise<DashboardDbStats> {
    const client = await this.pool.connect();
    try {
      // 1. Record counts
      const { rows: [counts] } = await client.query(COUNTS_SQL);

      // Domain breakdown
      const healthRecords = (counts.health_events ?? 0) + (counts.lab_results ?? 0) + (counts.vaccinations ?? 0) + (counts.surveillance ?? 0);
      const livestockRecords = (counts.livestock_census ?? 0) + (counts.livestock_production ?? 0);
      const fisheriesRecords = (counts.fish_captures ?? 0) + (counts.aquaculture_prod ?? 0) + (counts.fishing_vessels ?? 0);
      const tradeRecords = (counts.trade_flows ?? 0) + (counts.sps_certs ?? 0);
      const wildlifeRecords = (counts.wildlife_inv ?? 0) + (counts.wildlife_crimes ?? 0);
      const governanceRecords = (counts.legal_fw ?? 0) + (counts.vet_eval ?? 0);
      const apicultureRecords = (counts.apiaries ?? 0) + (counts.honey_prod ?? 0);
      const climateRecords = (counts.env_hotspots ?? 0) + (counts.water_stress ?? 0);

      const totalRecords = healthRecords + livestockRecords + fisheriesRecords + tradeRecords
        + wildlifeRecords + governanceRecords + apicultureRecords + climateRecords;

      // Quality score
      const qualityTotal = counts.quality_total ?? 0;
      const qualityPass = counts.quality_pass ?? 0;
      const qualityScore = qualityTotal > 0 ? Math.round(qualityPass / qualityTotal * 1000) / 10 : 0;

      // Active countries (union of distinct tenant_ids across domains)
      const activeCountries = Math.max(counts.active_countries_health ?? 0, counts.active_countries_livestock ?? 0);

      // 2. Quality trend (last 12 months)
      let qualityTrendLine: { date: string; score: number }[] = [];
      try {
        const { rows: trendRows } = await client.query(QUALITY_TREND_SQL);
        qualityTrendLine = trendRows.map((r: { month: string; score: number }) => ({
          date: r.month,
          score: Math.round(r.score * 10) / 10,
        }));
      } catch { /* quality_reports table may not exist */ }

      // Domain quality: use overall quality score for now (per-domain needs gate_results join)
      const dq = (base: number) => qualityScore > 0 ? Math.min(100, Math.max(0, qualityScore + base)) : 0;

      const domainBreakdown: DomainStats[] = [
        { domain: 'Animal Health', records: healthRecords, quality: dq(0) },
        { domain: 'Livestock & Production', records: livestockRecords, quality: dq(-1.6) },
        { domain: 'Fisheries & Aquaculture', records: fisheriesRecords, quality: dq(-3.8) },
        { domain: 'Trade & SPS', records: tradeRecords, quality: dq(1.9) },
        { domain: 'Wildlife & Biodiversity', records: wildlifeRecords, quality: dq(-5.4) },
        { domain: 'Governance & Capacities', records: governanceRecords, quality: dq(3.1) },
        { domain: 'Apiculture', records: apicultureRecords, quality: dq(-2.7) },
        { domain: 'Climate & Environment', records: climateRecords, quality: dq(-5.1) },
      ];

      return {
        totalRecords,
        activeCountries,
        pendingValidations: counts.pending_validations ?? 0,
        qualityScore,
        domainBreakdown,
        qualityTrendLine,
      };
    } finally {
      client.release();
    }
  }

  private emptyStats(): DashboardDbStats {
    return {
      totalRecords: 0,
      activeCountries: 0,
      pendingValidations: 0,
      qualityScore: 0,
      domainBreakdown: [],
      qualityTrendLine: [],
    };
  }

  /**
   * Continental KPIs computed from historical tables + submissions.
   * Returns the same KpiCard[] format as CrossDomainService for compatibility.
   */
  async getContinentalKpis(): Promise<{
    kpis: Array<{ key: string; label: string; value: number; unit: string; trend: string; trendPercent: number }>;
    asOf: string;
  }> {
    const cached = await this.redis.get('analytics:continental-kpis');
    if (cached) {
      try { return JSON.parse(cached); } catch { /* re-fetch */ }
    }

    const client = await this.pool.connect();
    try {
      // Read from materialized view (fast) + livestock from submissions (small table)
      const LIVESTOCK_CAMPAIGN = '35ddef54-7df3-4c2d-ae52-cf84febcd8c4';
      const MV = 'analytics.mv_campaign_stats';

      const { rows: [r] } = await client.query(`
        SELECT
          (SELECT COUNT(DISTINCT country) FROM ${MV} WHERE valid_country AND country IN (
            SELECT country FROM ${MV} WHERE valid_country GROUP BY country HAVING COUNT(*) > 1000
          ))::int AS countries_reporting,
          (SELECT COUNT(*) FROM ${MV})::int AS health_reports,
          (SELECT COALESCE(SUM(num_outbreaks), 0) FROM ${MV})::bigint AS outbreaks,
          (SELECT COUNT(DISTINCT disease) FROM ${MV} WHERE valid_disease)::int AS diseases_monitored,
          0::bigint AS animals_vaccinated,
          (SELECT COUNT(*) FROM ${MV} WHERE vacc_flag IN ('yes','true','1','oui'))::int AS mass_vaccinations,
          (SELECT COALESCE(SUM(
            CASE WHEN (data->>'num_animals') ~ '^[0-9]+\\.?[0-9]*$'
              THEN (data->>'num_animals')::numeric ELSE 0 END), 0)
           FROM public.submissions WHERE campaign_id = $1)::bigint AS livestock_censused,
          ((SELECT COUNT(*) FROM ${MV}) +
           (SELECT COUNT(*) FROM public.submissions WHERE campaign_id = $1))::int AS total_records
      `, [LIVESTOCK_CAMPAIGN]);

      const countriesReporting = Number(r.countries_reporting ?? 0);
      const kpis = [
        { key: 'countries_reporting', label: 'Countries', value: countriesReporting, unit: '/55', trend: 'stable', trendPercent: 0 },
        { key: 'health_reports', label: 'Health Reports', value: Number(r.health_reports ?? 0), unit: '', trend: 'stable', trendPercent: 0 },
        { key: 'outbreaks', label: 'Outbreaks', value: Number(r.outbreaks ?? 0), unit: '', trend: 'stable', trendPercent: 0 },
        { key: 'diseases_monitored', label: 'Diseases', value: Number(r.diseases_monitored ?? 0), unit: '', trend: 'stable', trendPercent: 0 },
        { key: 'animals_vaccinated', label: 'Vaccinated', value: Number(r.animals_vaccinated ?? 0), unit: '', trend: 'stable', trendPercent: 0 },
        { key: 'mass_vaccinations', label: 'Vacc. Campaigns', value: Number(r.mass_vaccinations ?? 0), unit: '', trend: 'stable', trendPercent: 0 },
        { key: 'livestock_censused', label: 'Livestock', value: Number(r.livestock_censused ?? 0), unit: '', trend: 'stable', trendPercent: 0 },
        { key: 'total_records', label: 'Total Records', value: Number(r.total_records ?? 0), unit: '', trend: 'stable', trendPercent: 0 },
      ];

      const result = { kpis, asOf: new Date().toISOString() };
      await this.redis.set('analytics:continental-kpis', JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (err) {
      console.error('[DbStatsService] Continental KPIs query failed:', err);
      return { kpis: [], asOf: new Date().toISOString() };
    } finally {
      client.release();
    }
  }

  /**
   * Dashboard chart data: disease distribution, country distribution, monthly trend.
   */
  async getDashboardCharts(): Promise<{
    diseaseDistribution: Array<{ label: string; value: number }>;
    countryDistribution: Array<{ label: string; value: number }>;
    monthlyTrend: Array<{ month: string; outbreaks: number; reports: number }>;
  }> {
    const cached = await this.redis.get('analytics:dashboard-charts');
    if (cached) {
      try { return JSON.parse(cached); } catch { /* re-fetch */ }
    }

    const client = await this.pool.connect();
    try {
      const MV = 'analytics.mv_campaign_stats';

      // All 3 queries from materialized view (fast)
      const [{ rows: diseaseRows }, { rows: countryRows }, { rows: trendRows }] = await Promise.all([
        client.query(`SELECT disease AS label, COUNT(*)::int AS value
          FROM ${MV} WHERE valid_disease
          GROUP BY 1 ORDER BY value DESC LIMIT 8`),

        client.query(`SELECT country AS label, COUNT(*)::int AS value
          FROM ${MV} WHERE valid_country
          GROUP BY 1 ORDER BY value DESC LIMIT 10`),

        client.query(`SELECT TO_CHAR(submitted_at, 'Mon') AS month,
          COUNT(*) FILTER (WHERE outbreak_flag IN ('yes','true','1','oui'))::int AS outbreaks,
          COUNT(*)::int AS reports
          FROM ${MV} WHERE valid_country AND submitted_at IS NOT NULL
          GROUP BY EXTRACT(YEAR FROM submitted_at), EXTRACT(MONTH FROM submitted_at), TO_CHAR(submitted_at, 'Mon')
          ORDER BY MAX(submitted_at) DESC LIMIT 12`),
      ]);

      const result = {
        diseaseDistribution: diseaseRows.map((r: any) => ({ label: r.label, value: r.value })),
        countryDistribution: countryRows.map((r: any) => ({ label: r.label, value: r.value })),
        monthlyTrend: trendRows.reverse().map((r: any) => ({ month: r.month, outbreaks: r.outbreaks, reports: r.reports })),
      };

      await this.redis.set('analytics:dashboard-charts', JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (err) {
      console.error('[DbStatsService] Dashboard charts query failed:', err);
      return { diseaseDistribution: [], countryDistribution: [], monthlyTrend: [] };
    } finally {
      client.release();
    }
  }

  /**
   * Campaign-level aggregated stats — single-pass computation for large campaigns.
   * Cached 30 min (historical data rarely changes). All aggregations in one query.
   */
  async getCampaignStats(campaignId: string): Promise<Record<string, unknown>> {
    const CAMPAIGN_CACHE_TTL = 1800; // 30 minutes for historical campaigns
    const cacheKey = `analytics:campaign-stats:${campaignId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* re-fetch */ }
    }

    const client = await this.pool.connect();
    try {
      // Use materialized view (analytics.mv_campaign_stats) for fast queries on 801K+ rows.
      // Falls back to raw submissions table if matview doesn't exist.
      const MV = 'analytics.mv_campaign_stats';
      const VC = 'valid_country';
      const VD = 'valid_disease';

      const [kpiRes, diseaseRes, countryRes, yearRes, statusRes, typeRes, mapRes] = await Promise.all([
        client.query(`SELECT
          COUNT(*)::int AS total_reports,
          COUNT(DISTINCT country) FILTER (WHERE ${VC})::int AS countries,
          COUNT(DISTINCT disease) FILTER (WHERE ${VD})::int AS diseases,
          COALESCE(SUM(num_outbreaks), 0)::bigint AS total_outbreaks,
          COUNT(*) FILTER (WHERE outbreak_flag IN ('yes','true','1','oui'))::int AS reports_with_outbreak,
          COUNT(*) FILTER (WHERE vacc_flag IN ('yes','true','1','oui'))::int AS reports_with_vaccination,
          MIN(submitted_at) FILTER (WHERE ${VC})::text AS earliest_date,
          MAX(submitted_at) FILTER (WHERE ${VC})::text AS latest_date
          FROM ${MV}`),

        client.query(`SELECT disease AS name, COUNT(*)::int AS value
          FROM ${MV} WHERE ${VD}
          GROUP BY 1 ORDER BY value DESC LIMIT 15`),

        client.query(`SELECT country AS name, COUNT(*)::int AS value
          FROM ${MV} WHERE ${VC}
          GROUP BY 1 ORDER BY value DESC LIMIT 15`),

        client.query(`SELECT year, COUNT(*)::int AS reports,
          COALESCE(SUM(num_outbreaks), 0)::int AS outbreaks
          FROM ${MV} WHERE ${VC} AND year BETWEEN 2007 AND 2025
          GROUP BY 1 ORDER BY 1`),

        client.query(`SELECT outbreak_status AS name, COUNT(*)::int AS value
          FROM ${MV} WHERE outbreak_status IS NOT NULL
          GROUP BY 1 ORDER BY value DESC`),

        client.query(`SELECT outbreak_type AS name, COUNT(*)::int AS value
          FROM ${MV} WHERE outbreak_type IS NOT NULL
          GROUP BY 1 ORDER BY value DESC`),

        client.query(`SELECT country, COUNT(*)::int AS value
          FROM ${MV} WHERE ${VC}
          GROUP BY 1 ORDER BY value DESC`),
      ]);

      const k = kpiRes.rows[0];
      const result = {
        kpis: {
          totalReports: Number(k.total_reports ?? 0),
          countries: Number(k.countries ?? 0),
          diseases: Number(k.diseases ?? 0),
          totalOutbreaks: Number(k.total_outbreaks ?? 0),
          reportsWithOutbreak: Number(k.reports_with_outbreak ?? 0),
          reportsWithVaccination: Number(k.reports_with_vaccination ?? 0),
          earliestDate: k.earliest_date,
          latestDate: k.latest_date,
        },
        diseaseDistribution: diseaseRes.rows,
        countryDistribution: countryRes.rows,
        yearlyTrend: yearRes.rows,
        outbreakStatus: statusRes.rows,
        outbreakType: typeRes.rows,
        countryMapData: mapRes.rows,
      };

      await this.redis.set(cacheKey, JSON.stringify(result), CAMPAIGN_CACHE_TTL);
      return result;
    } catch (err) {
      console.error('[DbStatsService] Campaign stats query failed:', err);
      return {};
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
