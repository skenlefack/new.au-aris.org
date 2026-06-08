/**
 * domain-summary.service.ts — Per-domain summary from form submissions + campaigns.
 *
 * Queries form_builder.form_submissions, form_builder.form_templates,
 * and public.collection_campaigns to build KPIs, synthesis, and recent
 * activity for a given business domain.
 *
 * Results are cached in Redis for 2 minutes (same pattern as DbStatsService).
 */

import { Pool } from 'pg';
import type { RedisClient } from '../services/redis-client';

const CACHE_TTL = 120; // 2 minutes

// ── Interfaces ──

export interface DomainSummary {
  kpis: {
    totalSubmissions: number;
    activeCountries: number;
    activeCampaigns: number;
    completionRate: number;
    qualityScore: number;
    trend: { current: number; previous: number; delta: number };
  };
  synthesis: {
    countryDistribution: { code: string; name: string; count: number }[];
    monthlyTrend: { month: string; count: number }[];
    subDomainBreakdown: { code: string; label: string; count: number }[];
  };
  recentActivity: {
    type: 'submission' | 'validation' | 'campaign_start';
    country?: string;
    formName?: string;
    timestamp: string;
  }[];
}

// ── Domain code mapping (route kebab-case → DB underscore) ──

const DOMAIN_DB_MAP: Record<string, string> = {
  'animal-health': 'animal_health',
  'livestock-prod': 'livestock',
  'trade-sps': 'trade',
  'climate-env': 'climate_env',
};

function dbDomain(code: string): string {
  return DOMAIN_DB_MAP[code] ?? code.replace(/-/g, '_');
}

// ── SQL Queries ──

const KPIS_SQL = `
SELECT
  (SELECT COUNT(*) FROM form_builder.form_submissions fs
   JOIN form_builder.form_templates ft ON ft.id = fs.template_id
   WHERE ft.domain = $1)::int AS total_submissions,

  (SELECT COUNT(DISTINCT fs.country_code) FROM form_builder.form_submissions fs
   JOIN form_builder.form_templates ft ON ft.id = fs.template_id
   WHERE ft.domain = $1 AND fs.country_code IS NOT NULL)::int AS active_countries,

  (SELECT COUNT(*) FROM public.collection_campaigns
   WHERE domain = $1 AND status = 'ACTIVE')::int AS active_campaigns,

  (SELECT COALESCE(SUM(target_submissions), 0) FROM public.collection_campaigns
   WHERE domain = $1 AND status IN ('ACTIVE', 'COMPLETED'))::int AS total_target,

  (SELECT COUNT(*) FROM form_builder.form_submissions fs
   JOIN form_builder.form_templates ft ON ft.id = fs.template_id
   WHERE ft.domain = $1 AND fs.created_at >= date_trunc('month', NOW()))::int AS current_month,

  (SELECT COUNT(*) FROM form_builder.form_submissions fs
   JOIN form_builder.form_templates ft ON ft.id = fs.template_id
   WHERE ft.domain = $1
   AND fs.created_at >= date_trunc('month', NOW() - interval '1 month')
   AND fs.created_at < date_trunc('month', NOW()))::int AS previous_month
`;

const COUNTRY_DISTRIBUTION_SQL = `
SELECT fs.country_code AS code, COUNT(*)::int AS count
FROM form_builder.form_submissions fs
JOIN form_builder.form_templates ft ON ft.id = fs.template_id
WHERE ft.domain = $1 AND fs.country_code IS NOT NULL
GROUP BY fs.country_code ORDER BY count DESC LIMIT 20
`;

const MONTHLY_TREND_SQL = `
SELECT to_char(date_trunc('month', fs.created_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
FROM form_builder.form_submissions fs
JOIN form_builder.form_templates ft ON ft.id = fs.template_id
WHERE ft.domain = $1 AND fs.created_at >= NOW() - interval '12 months'
GROUP BY date_trunc('month', fs.created_at)
ORDER BY month
`;

const SUB_DOMAIN_SQL = `
SELECT COALESCE(ft.sub_domain, 'general') AS code, ft.name AS label, COUNT(fs.id)::int AS count
FROM form_builder.form_templates ft
LEFT JOIN form_builder.form_submissions fs ON fs.template_id = ft.id
WHERE ft.domain = $1
GROUP BY ft.sub_domain, ft.name
ORDER BY count DESC
`;

const RECENT_ACTIVITY_SQL = `
SELECT 'submission' AS type, fs.country_code AS country, ft.name AS form_name, fs.created_at AS timestamp
FROM form_builder.form_submissions fs
JOIN form_builder.form_templates ft ON ft.id = fs.template_id
WHERE ft.domain = $1
ORDER BY fs.created_at DESC LIMIT 10
`;

// ── Service ──

export class DomainSummaryService {
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

  async getSummary(domainCode: string, tenantId?: string): Promise<DomainSummary> {
    const cacheKey = `analytics:domain-summary:${domainCode}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* stale cache, re-fetch */ }
    }

    const domain = dbDomain(domainCode);
    const result = await this.querySummary(domain);

    await this.redis.set(cacheKey, JSON.stringify(result), CACHE_TTL);
    return result;
  }

  private async querySummary(domain: string): Promise<DomainSummary> {
    const client = await this.pool.connect();
    try {
      // KPIs
      const kpis = await this.queryKpis(client, domain);

      // Synthesis
      const countryDistribution = await this.queryCountryDistribution(client, domain);
      const monthlyTrend = await this.queryMonthlyTrend(client, domain);
      const subDomainBreakdown = await this.querySubDomainBreakdown(client, domain);

      // Recent activity
      const recentActivity = await this.queryRecentActivity(client, domain);

      return { kpis, synthesis: { countryDistribution, monthlyTrend, subDomainBreakdown }, recentActivity };
    } finally {
      client.release();
    }
  }

  private async queryKpis(client: any, domain: string): Promise<DomainSummary['kpis']> {
    try {
      const { rows: [r] } = await client.query(KPIS_SQL, [domain]);
      const totalSubmissions = r.total_submissions ?? 0;
      const totalTarget = r.total_target ?? 0;
      const completionRate = totalTarget > 0
        ? Math.round((totalSubmissions / totalTarget) * 1000) / 10
        : 0;
      const current = r.current_month ?? 0;
      const previous = r.previous_month ?? 0;
      const delta = previous > 0
        ? Math.round(((current - previous) / previous) * 1000) / 10
        : 0;

      return {
        totalSubmissions,
        activeCountries: r.active_countries ?? 0,
        activeCampaigns: r.active_campaigns ?? 0,
        completionRate,
        qualityScore: 0, // placeholder — requires quality_reports per domain
        trend: { current, previous, delta },
      };
    } catch (err) {
      console.error('[DomainSummaryService] KPIs query failed:', err);
      return {
        totalSubmissions: 0,
        activeCountries: 0,
        activeCampaigns: 0,
        completionRate: 0,
        qualityScore: 0,
        trend: { current: 0, previous: 0, delta: 0 },
      };
    }
  }

  private async queryCountryDistribution(
    client: any,
    domain: string,
  ): Promise<DomainSummary['synthesis']['countryDistribution']> {
    try {
      const { rows } = await client.query(COUNTRY_DISTRIBUTION_SQL, [domain]);
      return rows.map((r: any) => ({ code: r.code, name: r.code, count: r.count }));
    } catch (err) {
      console.error('[DomainSummaryService] Country distribution query failed:', err);
      return [];
    }
  }

  private async queryMonthlyTrend(
    client: any,
    domain: string,
  ): Promise<DomainSummary['synthesis']['monthlyTrend']> {
    try {
      const { rows } = await client.query(MONTHLY_TREND_SQL, [domain]);
      return rows.map((r: any) => ({ month: r.month, count: r.count }));
    } catch (err) {
      console.error('[DomainSummaryService] Monthly trend query failed:', err);
      return [];
    }
  }

  private async querySubDomainBreakdown(
    client: any,
    domain: string,
  ): Promise<DomainSummary['synthesis']['subDomainBreakdown']> {
    try {
      const { rows } = await client.query(SUB_DOMAIN_SQL, [domain]);
      return rows.map((r: any) => ({ code: r.code, label: r.label, count: r.count }));
    } catch (err) {
      console.error('[DomainSummaryService] Sub-domain breakdown query failed:', err);
      return [];
    }
  }

  private async queryRecentActivity(
    client: any,
    domain: string,
  ): Promise<DomainSummary['recentActivity']> {
    try {
      const { rows } = await client.query(RECENT_ACTIVITY_SQL, [domain]);
      return rows.map((r: any) => ({
        type: r.type as 'submission',
        country: r.country ?? undefined,
        formName: r.form_name ?? undefined,
        timestamp: new Date(r.timestamp).toISOString(),
      }));
    } catch (err) {
      console.error('[DomainSummaryService] Recent activity query failed:', err);
      return [];
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
