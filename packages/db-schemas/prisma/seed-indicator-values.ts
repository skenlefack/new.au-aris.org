/**
 * Seed indicator values from REAL domain data into analytics.indicator_values
 * Part 1: Governance (~20) + Animal Health (24) + Livestock (31) = ~75 indicators
 *
 * Computes values by querying domain tables and joining with tenants for geo info.
 * Uses ON CONFLICT to upsert (idempotent).
 *
 * Run: DATABASE_URL="..." npx tsx packages/db-schemas/prisma/seed-indicator-values.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { Pool } from 'pg';
import { QUERIES_PART2 } from './seed-indicator-values-part2';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
});

interface IndicatorQuery {
  code: string;
  sql: string;
  source: string;
}

// =============================================================================
// GOVERNANCE INDICATORS (~20)
// =============================================================================

const GOVERNANCE_QUERIES: IndicatorQuery[] = [
  // active-outbreaks — COUNT active health events (no closure date)
  {
    code: 'active-outbreaks',
    source: 'animal_health.health_events',
    sql: `
      SELECT EXTRACT(YEAR FROM he.date_suspicion)::int AS year,
             EXTRACT(MONTH FROM he.date_suspicion)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM animal_health.health_events he
      JOIN public.tenants t ON t.id = he.tenant_id
      WHERE he.date_closure IS NULL
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // pvs-score-avg — AVG overall_score from vet evaluations (continental)
  {
    code: 'pvs-score-avg',
    source: 'governance.pvs_evaluations',
    sql: `
      SELECT EXTRACT(YEAR FROM ve.evaluation_date)::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             NULL AS country_code, NULL AS rec_code, true AS is_continental,
             AVG(ve.overall_score)::float AS value
      FROM governance.pvs_evaluations ve
      GROUP BY year`,
  },

  // pvs-score-continental-avg — per-country PVS scores
  {
    code: 'pvs-score-continental-avg',
    source: 'governance.pvs_evaluations',
    sql: `
      SELECT EXTRACT(YEAR FROM ve.evaluation_date)::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             AVG(ve.overall_score)::float AS value
      FROM governance.pvs_evaluations ve
      JOIN public.tenants t ON t.id = ve.tenant_id
      WHERE t.country_code IS NOT NULL
      GROUP BY year, t.country_code, t.rec_code`,
  },

  // countries-evaluated — COUNT DISTINCT countries with PVS eval
  {
    code: 'countries-evaluated',
    source: 'governance.pvs_evaluations',
    sql: `
      SELECT EXTRACT(YEAR FROM ve.evaluation_date)::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             NULL AS country_code, NULL AS rec_code, true AS is_continental,
             COUNT(DISTINCT t.country_code)::float AS value
      FROM governance.pvs_evaluations ve
      JOIN public.tenants t ON t.id = ve.tenant_id
      WHERE t.country_code IS NOT NULL
      GROUP BY year`,
  },

  // legal-frameworks-in-force
  {
    code: 'legal-frameworks-in-force',
    source: 'governance.legal_frameworks',
    sql: `
      SELECT EXTRACT(YEAR FROM COALESCE(lf.adoption_date, lf.created_at))::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM governance.legal_frameworks lf
      JOIN public.tenants t ON t.id = lf.tenant_id
      WHERE lf.status = 'IN_FORCE'
      GROUP BY year, t.country_code, t.rec_code`,
  },

  // total-vet-budget-usd
  {
    code: 'total-vet-budget-usd',
    source: 'governance.institutional_capacities',
    sql: `
      SELECT ic.year, NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             SUM(ic.budget_usd)::float AS value
      FROM governance.institutional_capacities ic
      JOIN public.tenants t ON t.id = ic.tenant_id
      GROUP BY ic.year, t.country_code, t.rec_code`,
  },

  // laws-in-force — COUNT WHERE type='LAW' AND status='IN_FORCE'
  {
    code: 'laws-in-force',
    source: 'governance.legal_frameworks',
    sql: `
      SELECT EXTRACT(YEAR FROM COALESCE(lf.adoption_date, lf.created_at))::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM governance.legal_frameworks lf
      JOIN public.tenants t ON t.id = lf.tenant_id
      WHERE lf.type ILIKE '%LAW%' AND lf.status = 'IN_FORCE'
      GROUP BY year, t.country_code, t.rec_code`,
  },

  // regulations-adopted — COUNT WHERE type='REGULATION' AND status IN ('ADOPTED','IN_FORCE')
  {
    code: 'regulations-adopted',
    source: 'governance.legal_frameworks',
    sql: `
      SELECT EXTRACT(YEAR FROM COALESCE(lf.adoption_date, lf.created_at))::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM governance.legal_frameworks lf
      JOIN public.tenants t ON t.id = lf.tenant_id
      WHERE lf.type ILIKE '%REGULATION%' AND lf.status IN ('ADOPTED', 'IN_FORCE')
      GROUP BY year, t.country_code, t.rec_code`,
  },

  // policies-draft — COUNT WHERE type='POLICY' AND status='DRAFT'
  {
    code: 'policies-draft',
    source: 'governance.legal_frameworks',
    sql: `
      SELECT EXTRACT(YEAR FROM COALESCE(lf.adoption_date, lf.created_at))::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM governance.legal_frameworks lf
      JOIN public.tenants t ON t.id = lf.tenant_id
      WHERE lf.type ILIKE '%POLICY%' AND lf.status = 'DRAFT'
      GROUP BY year, t.country_code, t.rec_code`,
  },

  // stakeholders-registered — COUNT from stakeholder_registry
  {
    code: 'stakeholders-registered',
    source: 'governance.stakeholder_registry',
    sql: `
      SELECT EXTRACT(YEAR FROM sr.created_at)::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM governance.stakeholder_registry sr
      JOIN public.tenants t ON t.id = sr.tenant_id
      GROUP BY year, t.country_code, t.rec_code`,
  },

  // member-states-count — COUNT DISTINCT active MEMBER_STATE tenants
  {
    code: 'member-states-count',
    source: 'public.tenants',
    sql: `
      SELECT EXTRACT(YEAR FROM NOW())::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             NULL AS country_code, NULL AS rec_code, true AS is_continental,
             COUNT(*)::float AS value
      FROM public.tenants
      WHERE level = 'MEMBER_STATE' AND is_active = true`,
  },

  // national-livestock-total — SUM population / 1M from livestock_census
  {
    code: 'national-livestock-total',
    source: 'livestock_prod.livestock_census',
    sql: `
      SELECT lc.year, NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             (SUM(lc.population) / 1000000.0)::float AS value
      FROM livestock_prod.livestock_census lc
      JOIN public.tenants t ON t.id = lc.tenant_id
      WHERE t.country_code IS NOT NULL
      GROUP BY lc.year, t.country_code, t.rec_code`,
  },

  // national-outbreaks — COUNT health_events per country
  {
    code: 'national-outbreaks',
    source: 'animal_health.health_events',
    sql: `
      SELECT EXTRACT(YEAR FROM he.date_suspicion)::int AS year,
             EXTRACT(MONTH FROM he.date_suspicion)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM animal_health.health_events he
      JOIN public.tenants t ON t.id = he.tenant_id
      WHERE t.country_code IS NOT NULL
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // national-trade-volume — SUM trade_flows quantity per country
  {
    code: 'national-trade-volume',
    source: 'trade_sps.trade_flows',
    sql: `
      SELECT EXTRACT(YEAR FROM tf.period_start)::int AS year,
             NULL::int AS month,
             EXTRACT(QUARTER FROM tf.period_start)::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             SUM(tf.quantity)::float AS value
      FROM trade_sps.trade_flows tf
      JOIN public.tenants t ON t.id = tf.tenant_id
      WHERE t.country_code IS NOT NULL
      GROUP BY year, quarter, t.country_code, t.rec_code`,
  },

  // national-pvs-score — LATEST vet_evaluation per country
  {
    code: 'national-pvs-score',
    source: 'governance.pvs_evaluations',
    sql: `
      SELECT DISTINCT ON (t.country_code)
             EXTRACT(YEAR FROM ve.evaluation_date)::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             ve.overall_score::float AS value
      FROM governance.pvs_evaluations ve
      JOIN public.tenants t ON t.id = ve.tenant_id
      WHERE t.country_code IS NOT NULL
      ORDER BY t.country_code, ve.evaluation_date DESC`,
  },

  // quality-pass-rate — SKIP: requires workflow validation data not directly queryable
  // timeliness-rate — SKIP: requires workflow submission timestamps analysis
  // countries-reporting — SKIP: requires cross-domain submission tracking
  // total-submissions — SKIP: requires workflow instance counting
  // pending-l1/l2/l3 — SKIP: requires workflow state machine queries
  // validated-l4 — SKIP: requires workflow state machine queries
  // rec-data-completeness — SKIP: composite metric requiring cross-domain analysis
  // rec-active-outbreaks — already covered by active-outbreaks with REC aggregation pass
  // rec-trade-volume — already covered by national-trade-volume with REC aggregation pass
  // animal-health-score — SKIP: composite score computed from multiple sub-indicators
  // environment-score — SKIP: composite score
  // capacity-score — SKIP: composite score
];

// =============================================================================
// ANIMAL HEALTH INDICATORS (24)
// =============================================================================

const ANIMAL_HEALTH_QUERIES: IndicatorQuery[] = [
  // ah-active-outbreaks — COUNT active (no closure) health events
  {
    code: 'ah-active-outbreaks',
    source: 'animal_health.health_events',
    sql: `
      SELECT EXTRACT(YEAR FROM he.date_suspicion)::int AS year,
             EXTRACT(MONTH FROM he.date_suspicion)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM animal_health.health_events he
      JOIN public.tenants t ON t.id = he.tenant_id
      WHERE he.date_closure IS NULL
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-notification-rate — % events where suspicion-to-creation < 24h
  {
    code: 'ah-notification-rate',
    source: 'animal_health.health_events',
    sql: `
      SELECT EXTRACT(YEAR FROM he.date_suspicion)::int AS year,
             EXTRACT(MONTH FROM he.date_suspicion)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             (100.0 * COUNT(*) FILTER (
               WHERE EXTRACT(EPOCH FROM he.created_at - he.date_suspicion) / 3600 <= 24
             ) / NULLIF(COUNT(*), 0))::float AS value
      FROM animal_health.health_events he
      JOIN public.tenants t ON t.id = he.tenant_id
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-confirmed-month — COUNT events confirmed this month
  {
    code: 'ah-confirmed-month',
    source: 'animal_health.health_events',
    sql: `
      SELECT EXTRACT(YEAR FROM he.date_confirmation)::int AS year,
             EXTRACT(MONTH FROM he.date_confirmation)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM animal_health.health_events he
      JOIN public.tenants t ON t.id = he.tenant_id
      WHERE he.date_confirmation IS NOT NULL AND he.event_type = 'CONFIRMED'
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-case-fatality-rate — deaths / cases * 100
  {
    code: 'ah-case-fatality-rate',
    source: 'animal_health.health_events',
    sql: `
      SELECT EXTRACT(YEAR FROM he.date_suspicion)::int AS year,
             EXTRACT(MONTH FROM he.date_suspicion)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             (100.0 * SUM(he.deaths) / NULLIF(SUM(he.cases), 0))::float AS value
      FROM animal_health.health_events he
      JOIN public.tenants t ON t.id = he.tenant_id
      WHERE he.cases > 0
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-detection-to-confirmation — AVG days from suspicion to confirmation
  {
    code: 'ah-detection-to-confirmation',
    source: 'animal_health.health_events',
    sql: `
      SELECT EXTRACT(YEAR FROM he.date_confirmation)::int AS year,
             EXTRACT(MONTH FROM he.date_confirmation)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             AVG(EXTRACT(EPOCH FROM he.date_confirmation - he.date_suspicion) / 86400)::float AS value
      FROM animal_health.health_events he
      JOIN public.tenants t ON t.id = he.tenant_id
      WHERE he.date_confirmation IS NOT NULL AND he.date_suspicion IS NOT NULL
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-confirmation-to-response — AVG days from confirmation to first control measure
  // Approximation: use confirmation to closure as proxy (no separate response_date field)
  {
    code: 'ah-confirmation-to-response',
    source: 'animal_health.health_events',
    sql: `
      SELECT EXTRACT(YEAR FROM he.date_confirmation)::int AS year,
             EXTRACT(MONTH FROM he.date_confirmation)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             AVG(EXTRACT(EPOCH FROM he.date_closure - he.date_confirmation) / 86400)::float AS value
      FROM animal_health.health_events he
      JOIN public.tenants t ON t.id = he.tenant_id
      WHERE he.date_confirmation IS NOT NULL AND he.date_closure IS NOT NULL
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-wahis-ready-rate — % events marked wahis_ready
  {
    code: 'ah-wahis-ready-rate',
    source: 'animal_health.health_events',
    sql: `
      SELECT EXTRACT(YEAR FROM he.date_suspicion)::int AS year,
             EXTRACT(MONTH FROM he.date_suspicion)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             (100.0 * COUNT(*) FILTER (WHERE he.wahis_ready = true)
               / NULLIF(COUNT(*), 0))::float AS value
      FROM animal_health.health_events he
      JOIN public.tenants t ON t.id = he.tenant_id
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-vaccination-coverage-avg — AVG coverage_estimate from vaccination campaigns
  {
    code: 'ah-vaccination-coverage-avg',
    source: 'animal_health.vaccination_campaigns',
    sql: `
      SELECT EXTRACT(YEAR FROM vc.period_start)::int AS year,
             NULL::int AS month,
             EXTRACT(QUARTER FROM vc.period_start)::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             AVG(vc.coverage_estimate)::float AS value
      FROM animal_health.vaccination_campaigns vc
      JOIN public.tenants t ON t.id = vc.tenant_id
      GROUP BY year, quarter, t.country_code, t.rec_code`,
  },

  // ah-doses-utilization — doses_used / doses_delivered * 100
  {
    code: 'ah-doses-utilization',
    source: 'animal_health.vaccination_campaigns',
    sql: `
      SELECT EXTRACT(YEAR FROM vc.period_start)::int AS year,
             NULL::int AS month,
             EXTRACT(QUARTER FROM vc.period_start)::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             (100.0 * SUM(vc.doses_used) / NULLIF(SUM(vc.doses_delivered), 0))::float AS value
      FROM animal_health.vaccination_campaigns vc
      JOIN public.tenants t ON t.id = vc.tenant_id
      WHERE vc.doses_delivered > 0
      GROUP BY year, quarter, t.country_code, t.rec_code`,
  },

  // ah-active-campaigns — COUNT campaigns where period_end > NOW()
  {
    code: 'ah-active-campaigns',
    source: 'animal_health.vaccination_campaigns',
    sql: `
      SELECT EXTRACT(YEAR FROM vc.period_start)::int AS year,
             EXTRACT(MONTH FROM vc.period_start)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM animal_health.vaccination_campaigns vc
      JOIN public.tenants t ON t.id = vc.tenant_id
      WHERE vc.period_end >= NOW() OR vc.period_end IS NULL
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-target-remaining — SUM(target_population - doses_used) for active campaigns
  {
    code: 'ah-target-remaining',
    source: 'animal_health.vaccination_campaigns',
    sql: `
      SELECT EXTRACT(YEAR FROM vc.period_start)::int AS year,
             EXTRACT(MONTH FROM vc.period_start)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             SUM(GREATEST(vc.target_population - vc.doses_used, 0))::float AS value
      FROM animal_health.vaccination_campaigns vc
      JOIN public.tenants t ON t.id = vc.tenant_id
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-lab-analyses-month — COUNT lab results per month
  {
    code: 'ah-lab-analyses-month',
    source: 'animal_health.lab_results',
    sql: `
      SELECT EXTRACT(YEAR FROM lr.date_collected)::int AS year,
             EXTRACT(MONTH FROM lr.date_collected)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM animal_health.lab_results lr
      JOIN public.tenants t ON t.id = lr.tenant_id
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-positivity-rate — % positive lab results
  {
    code: 'ah-positivity-rate',
    source: 'animal_health.lab_results',
    sql: `
      SELECT EXTRACT(YEAR FROM lr.date_collected)::int AS year,
             EXTRACT(MONTH FROM lr.date_collected)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             (100.0 * COUNT(*) FILTER (WHERE lr.result = 'POSITIVE')
               / NULLIF(COUNT(*), 0))::float AS value
      FROM animal_health.lab_results lr
      JOIN public.tenants t ON t.id = lr.tenant_id
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-lab-turnaround-avg — AVG turnaround_days
  {
    code: 'ah-lab-turnaround-avg',
    source: 'animal_health.lab_results',
    sql: `
      SELECT EXTRACT(YEAR FROM lr.date_collected)::int AS year,
             EXTRACT(MONTH FROM lr.date_collected)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             AVG(lr.turnaround_days)::float AS value
      FROM animal_health.lab_results lr
      JOIN public.tenants t ON t.id = lr.tenant_id
      WHERE lr.turnaround_days > 0
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-labs-eqa — COUNT DISTINCT labs with eqa_flag = true
  {
    code: 'ah-labs-eqa',
    source: 'animal_health.lab_results',
    sql: `
      SELECT EXTRACT(YEAR FROM lr.date_collected)::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             COUNT(DISTINCT lr.lab_id)::float AS value
      FROM animal_health.lab_results lr
      JOIN public.tenants t ON t.id = lr.tenant_id
      WHERE lr.eqa_flag = true
      GROUP BY year, t.country_code, t.rec_code`,
  },

  // ah-aquatic-events — COUNT health events linked to aquatic species
  // Uses species_ids array overlapping with aquatic species from ref_species_groups
  {
    code: 'ah-aquatic-events',
    source: 'animal_health.health_events',
    sql: `
      SELECT EXTRACT(YEAR FROM he.date_suspicion)::int AS year,
             EXTRACT(MONTH FROM he.date_suspicion)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             COUNT(DISTINCT he.id)::float AS value
      FROM animal_health.health_events he
      JOIN public.tenants t ON t.id = he.tenant_id
      WHERE EXISTS (
        SELECT 1 FROM animal_health.ref_species rs
        JOIN animal_health.ref_species_groups rsg ON rsg.id = rs.group_id
        WHERE rs.id = ANY(he.species_ids)
          AND (rsg.code ILIKE '%aquatic%' OR rsg.code ILIKE '%fish%' OR rs.code ILIKE '%aqua%')
      )
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-aquatic-species — COUNT DISTINCT aquatic species affected
  {
    code: 'ah-aquatic-species',
    source: 'animal_health.health_events',
    sql: `
      SELECT EXTRACT(YEAR FROM he.date_suspicion)::int AS year,
             EXTRACT(MONTH FROM he.date_suspicion)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             COUNT(DISTINCT s_id)::float AS value
      FROM animal_health.health_events he
      JOIN public.tenants t ON t.id = he.tenant_id
      CROSS JOIN LATERAL unnest(he.species_ids) AS s_id
      JOIN animal_health.ref_species rs ON rs.id = s_id
      JOIN animal_health.ref_species_groups rsg ON rsg.id = rs.group_id
      WHERE rsg.code ILIKE '%aquatic%' OR rsg.code ILIKE '%fish%' OR rs.code ILIKE '%aqua%'
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-aquatic-lab-confirmed — COUNT lab results linked to aquatic events with POSITIVE result
  {
    code: 'ah-aquatic-lab-confirmed',
    source: 'animal_health.lab_results',
    sql: `
      SELECT EXTRACT(YEAR FROM lr.date_collected)::int AS year,
             EXTRACT(MONTH FROM lr.date_collected)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM animal_health.lab_results lr
      JOIN public.tenants t ON t.id = lr.tenant_id
      JOIN animal_health.health_events he ON he.id = lr.health_event_id
      WHERE lr.result = 'POSITIVE'
        AND EXISTS (
          SELECT 1 FROM animal_health.ref_species rs
          JOIN animal_health.ref_species_groups rsg ON rsg.id = rs.group_id
          WHERE rs.id = ANY(he.species_ids)
            AND (rsg.code ILIKE '%aquatic%' OR rsg.code ILIKE '%fish%' OR rs.code ILIKE '%aqua%')
        )
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-aquatic-surveillance — COUNT active surveillance activities targeting aquatic diseases
  {
    code: 'ah-aquatic-surveillance',
    source: 'animal_health.surveillance_activities',
    sql: `
      SELECT EXTRACT(YEAR FROM sa.period_start)::int AS year,
             EXTRACT(MONTH FROM sa.period_start)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM animal_health.surveillance_activities sa
      JOIN public.tenants t ON t.id = sa.tenant_id
      JOIN animal_health.ref_diseases rd ON rd.id = sa.disease_id
      WHERE rd.category ILIKE '%aquatic%'
         OR rd.code ILIKE '%aqua%'
         OR rd.code ILIKE '%fish%'
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-amr-samples — COUNT lab results with AMR-related test_type
  {
    code: 'ah-amr-samples',
    source: 'animal_health.lab_results',
    sql: `
      SELECT EXTRACT(YEAR FROM lr.date_collected)::int AS year,
             EXTRACT(MONTH FROM lr.date_collected)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM animal_health.lab_results lr
      JOIN public.tenants t ON t.id = lr.tenant_id
      WHERE lr.test_type ILIKE '%AMR%'
         OR lr.test_type ILIKE '%antimicrobial%'
         OR lr.test_type ILIKE '%resistance%'
         OR lr.test_type ILIKE '%susceptibility%'
         OR lr.test_type ILIKE '%MIC%'
         OR lr.test_type ILIKE '%disk%diffusion%'
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-amr-resistance-rate — % POSITIVE among AMR tests
  {
    code: 'ah-amr-resistance-rate',
    source: 'animal_health.lab_results',
    sql: `
      SELECT EXTRACT(YEAR FROM lr.date_collected)::int AS year,
             EXTRACT(MONTH FROM lr.date_collected)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             (100.0 * COUNT(*) FILTER (WHERE lr.result = 'POSITIVE')
               / NULLIF(COUNT(*), 0))::float AS value
      FROM animal_health.lab_results lr
      JOIN public.tenants t ON t.id = lr.tenant_id
      WHERE lr.test_type ILIKE '%AMR%'
         OR lr.test_type ILIKE '%antimicrobial%'
         OR lr.test_type ILIKE '%resistance%'
         OR lr.test_type ILIKE '%susceptibility%'
         OR lr.test_type ILIKE '%MIC%'
         OR lr.test_type ILIKE '%disk%diffusion%'
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // ah-amr-sentinel-sites — COUNT DISTINCT labs doing AMR testing
  {
    code: 'ah-amr-sentinel-sites',
    source: 'animal_health.lab_results',
    sql: `
      SELECT EXTRACT(YEAR FROM lr.date_collected)::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             COUNT(DISTINCT lr.lab_id)::float AS value
      FROM animal_health.lab_results lr
      JOIN public.tenants t ON t.id = lr.tenant_id
      WHERE lr.test_type ILIKE '%AMR%'
         OR lr.test_type ILIKE '%antimicrobial%'
         OR lr.test_type ILIKE '%resistance%'
         OR lr.test_type ILIKE '%susceptibility%'
      GROUP BY year, t.country_code, t.rec_code`,
  },

  // ah-amr-pathogens — COUNT DISTINCT sample_type (as proxy for pathogen types) in AMR tests
  {
    code: 'ah-amr-pathogens',
    source: 'animal_health.lab_results',
    sql: `
      SELECT EXTRACT(YEAR FROM lr.date_collected)::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             COUNT(DISTINCT lr.sample_type)::float AS value
      FROM animal_health.lab_results lr
      JOIN public.tenants t ON t.id = lr.tenant_id
      WHERE lr.test_type ILIKE '%AMR%'
         OR lr.test_type ILIKE '%antimicrobial%'
         OR lr.test_type ILIKE '%resistance%'
         OR lr.test_type ILIKE '%susceptibility%'
      GROUP BY year, t.country_code, t.rec_code`,
  },
];

// =============================================================================
// LIVESTOCK INDICATORS (31)
// =============================================================================

const LIVESTOCK_QUERIES: IndicatorQuery[] = [
  // total-livestock — SUM all livestock census population (M heads)
  {
    code: 'total-livestock',
    source: 'livestock_prod.livestock_census',
    sql: `
      SELECT lc.year, NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             (SUM(lc.population) / 1000000.0)::float AS value
      FROM livestock_prod.livestock_census lc
      JOIN public.tenants t ON t.id = lc.tenant_id
      GROUP BY lc.year, t.country_code, t.rec_code`,
  },

  // total-population — same as total-livestock but potentially different scope
  {
    code: 'total-population',
    source: 'livestock_prod.livestock_census',
    sql: `
      SELECT lc.year, NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             (SUM(lc.population) / 1000000.0)::float AS value
      FROM livestock_prod.livestock_census lc
      JOIN public.tenants t ON t.id = lc.tenant_id
      GROUP BY lc.year, t.country_code, t.rec_code`,
  },

  // annual-growth-rate — (current_year - prev_year) / prev_year * 100
  {
    code: 'annual-growth-rate',
    source: 'livestock_prod.livestock_census',
    sql: `
      WITH yearly AS (
        SELECT lc.year, t.country_code, t.rec_code,
               SUM(lc.population) AS total
        FROM livestock_prod.livestock_census lc
        JOIN public.tenants t ON t.id = lc.tenant_id
        GROUP BY lc.year, t.country_code, t.rec_code
      )
      SELECT y.year, NULL::int AS month, NULL::int AS quarter,
             y.country_code, y.rec_code, false AS is_continental,
             (100.0 * (y.total - yp.total) / NULLIF(yp.total, 0))::float AS value
      FROM yearly y
      JOIN yearly yp ON yp.year = y.year - 1
        AND COALESCE(yp.country_code, '') = COALESCE(y.country_code, '')
        AND COALESCE(yp.rec_code, '') = COALESCE(y.rec_code, '')
      WHERE yp.total > 0`,
  },

  // species-covered — COUNT DISTINCT species in census per country per year
  {
    code: 'species-covered',
    source: 'livestock_prod.livestock_census',
    sql: `
      SELECT lc.year, NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             COUNT(DISTINCT lc.species_id)::float AS value
      FROM livestock_prod.livestock_census lc
      JOIN public.tenants t ON t.id = lc.tenant_id
      GROUP BY lc.year, t.country_code, t.rec_code`,
  },

  // geo-coverage — % of countries with census data for given year
  {
    code: 'geo-coverage',
    source: 'livestock_prod.livestock_census',
    sql: `
      SELECT lc.year, NULL::int AS month, NULL::int AS quarter,
             NULL AS country_code, NULL AS rec_code, true AS is_continental,
             (100.0 * COUNT(DISTINCT t.country_code)
               / NULLIF((SELECT COUNT(*) FROM public.tenants WHERE level = 'MEMBER_STATE' AND is_active = true), 0))::float AS value
      FROM livestock_prod.livestock_census lc
      JOIN public.tenants t ON t.id = lc.tenant_id
      WHERE t.country_code IS NOT NULL
      GROUP BY lc.year`,
  },

  // cattle-population — SUM population for cattle species (M heads)
  {
    code: 'cattle-population',
    source: 'livestock_prod.livestock_census',
    sql: `
      SELECT lc.year, NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             (SUM(lc.population) / 1000000.0)::float AS value
      FROM livestock_prod.livestock_census lc
      JOIN public.tenants t ON t.id = lc.tenant_id
      JOIN animal_health.ref_species rs ON rs.id = lc.species_id
      WHERE rs.code ILIKE '%cattle%'
         OR rs.code ILIKE '%BOS%'
         OR rs.code ILIKE '%bovine%'
         OR (rs.name::text ILIKE '%cattle%' OR rs.name::text ILIKE '%bovine%' OR rs.name::text ILIKE '%bovin%')
      GROUP BY lc.year, t.country_code, t.rec_code`,
  },

  // meat-production-tonnes — SUM production where product_type is meat
  {
    code: 'meat-production-tonnes',
    source: 'livestock_prod.production_records',
    sql: `
      SELECT EXTRACT(YEAR FROM pr.period_start)::int AS year,
             NULL::int AS month,
             EXTRACT(QUARTER FROM pr.period_start)::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             SUM(pr.quantity)::float AS value
      FROM livestock_prod.production_records pr
      JOIN public.tenants t ON t.id = pr.tenant_id
      WHERE pr.product_type ILIKE '%meat%' AND pr.unit ILIKE '%tonne%'
      GROUP BY year, quarter, t.country_code, t.rec_code`,
  },

  // meat-production-total — annual SUM production where product_type is meat
  {
    code: 'meat-production-total',
    source: 'livestock_prod.production_records',
    sql: `
      SELECT EXTRACT(YEAR FROM pr.period_start)::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             SUM(pr.quantity)::float AS value
      FROM livestock_prod.production_records pr
      JOIN public.tenants t ON t.id = pr.tenant_id
      WHERE pr.product_type ILIKE '%meat%'
      GROUP BY year, t.country_code, t.rec_code`,
  },

  // slaughter-count-month — SUM slaughter count per month
  {
    code: 'slaughter-count-month',
    source: 'livestock_prod.slaughter_records',
    sql: `
      SELECT EXTRACT(YEAR FROM sr.period_start)::int AS year,
             EXTRACT(MONTH FROM sr.period_start)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             SUM(sr.count)::float AS value
      FROM livestock_prod.slaughter_records sr
      JOIN public.tenants t ON t.id = sr.tenant_id
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // cattle-price-avg — AVG market price for cattle species
  {
    code: 'cattle-price-avg',
    source: 'trade_sps.market_prices',
    sql: `
      SELECT EXTRACT(YEAR FROM mp.date)::int AS year,
             EXTRACT(MONTH FROM mp.date)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             AVG(mp.price)::float AS value
      FROM trade_sps.market_prices mp
      JOIN public.tenants t ON t.id = mp.tenant_id
      JOIN animal_health.ref_species rs ON rs.id = mp.species_id
      WHERE rs.code ILIKE '%cattle%'
         OR rs.code ILIKE '%BOS%'
         OR rs.name::text ILIKE '%cattle%'
         OR rs.name::text ILIKE '%bovine%'
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // lp-condemnation-rate — condemnations / count * 100 at slaughter
  {
    code: 'lp-condemnation-rate',
    source: 'livestock_prod.slaughter_records',
    sql: `
      SELECT EXTRACT(YEAR FROM sr.period_start)::int AS year,
             EXTRACT(MONTH FROM sr.period_start)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             (100.0 * SUM(sr.condemnations) / NULLIF(SUM(sr.count), 0))::float AS value
      FROM livestock_prod.slaughter_records sr
      JOIN public.tenants t ON t.id = sr.tenant_id
      WHERE sr.count > 0
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // milk-production-total — SUM production where product_type is milk
  {
    code: 'milk-production-total',
    source: 'livestock_prod.production_records',
    sql: `
      SELECT EXTRACT(YEAR FROM pr.period_start)::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             SUM(pr.quantity)::float AS value
      FROM livestock_prod.production_records pr
      JOIN public.tenants t ON t.id = pr.tenant_id
      WHERE pr.product_type ILIKE '%milk%' OR pr.product_type ILIKE '%dairy%'
      GROUP BY year, t.country_code, t.rec_code`,
  },

  // dairy-herd-size — SUM cattle population that is dairy breed (approximation: all cattle as proxy)
  // NOTE: Without a dairy/non-dairy flag on census, we use cattle population as a rough proxy
  {
    code: 'dairy-herd-size',
    source: 'livestock_prod.livestock_census',
    sql: `
      SELECT lc.year, NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             (SUM(lc.population) / 1000000.0)::float AS value
      FROM livestock_prod.livestock_census lc
      JOIN public.tenants t ON t.id = lc.tenant_id
      JOIN animal_health.ref_species rs ON rs.id = lc.species_id
      JOIN animal_health.ref_breeds rb ON rb.species_id = rs.id AND rb.purpose ILIKE '%dairy%'
      WHERE rs.code ILIKE '%cattle%' OR rs.code ILIKE '%BOS%'
         OR rs.name::text ILIKE '%cattle%' OR rs.name::text ILIKE '%bovine%'
      GROUP BY lc.year, t.country_code, t.rec_code`,
  },

  // milk-price-avg — AVG market price for milk/dairy commodity
  {
    code: 'milk-price-avg',
    source: 'trade_sps.market_prices',
    sql: `
      SELECT EXTRACT(YEAR FROM mp.date)::int AS year,
             EXTRACT(MONTH FROM mp.date)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             AVG(mp.price)::float AS value
      FROM trade_sps.market_prices mp
      JOIN public.tenants t ON t.id = mp.tenant_id
      WHERE mp.commodity ILIKE '%milk%' OR mp.commodity ILIKE '%dairy%' OR mp.commodity ILIKE '%lait%'
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // dairy-export-volume — SUM trade_flows quantity for dairy commodity exports
  {
    code: 'dairy-export-volume',
    source: 'trade_sps.trade_flows',
    sql: `
      SELECT EXTRACT(YEAR FROM tf.period_start)::int AS year,
             NULL::int AS month,
             EXTRACT(QUARTER FROM tf.period_start)::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             SUM(tf.quantity)::float AS value
      FROM trade_sps.trade_flows tf
      JOIN public.tenants t ON t.id = tf.tenant_id
      WHERE tf.flow_direction = 'EXPORT'
        AND (tf.commodity ILIKE '%milk%' OR tf.commodity ILIKE '%dairy%'
             OR tf.commodity_group ILIKE '%dairy%')
      GROUP BY year, quarter, t.country_code, t.rec_code`,
  },

  // poultry-population — SUM census for poultry species (M heads)
  {
    code: 'poultry-population',
    source: 'livestock_prod.livestock_census',
    sql: `
      SELECT lc.year, NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             (SUM(lc.population) / 1000000.0)::float AS value
      FROM livestock_prod.livestock_census lc
      JOIN public.tenants t ON t.id = lc.tenant_id
      JOIN animal_health.ref_species rs ON rs.id = lc.species_id
      WHERE rs.code ILIKE '%poultry%'
         OR rs.code ILIKE '%chicken%'
         OR rs.code ILIKE '%GAL%'
         OR rs.name::text ILIKE '%poultry%'
         OR rs.name::text ILIKE '%chicken%'
         OR rs.name::text ILIKE '%volaille%'
         OR rs.name::text ILIKE '%poulet%'
      GROUP BY lc.year, t.country_code, t.rec_code`,
  },

  // egg-production — SUM production where product_type is egg (monthly)
  {
    code: 'egg-production',
    source: 'livestock_prod.production_records',
    sql: `
      SELECT EXTRACT(YEAR FROM pr.period_start)::int AS year,
             EXTRACT(MONTH FROM pr.period_start)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             SUM(pr.quantity)::float AS value
      FROM livestock_prod.production_records pr
      JOIN public.tenants t ON t.id = pr.tenant_id
      WHERE pr.product_type ILIKE '%egg%' OR pr.product_type ILIKE '%oeuf%'
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // egg-production-total — annual SUM
  {
    code: 'egg-production-total',
    source: 'livestock_prod.production_records',
    sql: `
      SELECT EXTRACT(YEAR FROM pr.period_start)::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             SUM(pr.quantity)::float AS value
      FROM livestock_prod.production_records pr
      JOIN public.tenants t ON t.id = pr.tenant_id
      WHERE pr.product_type ILIKE '%egg%' OR pr.product_type ILIKE '%oeuf%'
      GROUP BY year, t.country_code, t.rec_code`,
  },

  // poultry-slaughter-month — SUM slaughter for poultry species
  {
    code: 'poultry-slaughter-month',
    source: 'livestock_prod.slaughter_records',
    sql: `
      SELECT EXTRACT(YEAR FROM sr.period_start)::int AS year,
             EXTRACT(MONTH FROM sr.period_start)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             SUM(sr.count)::float AS value
      FROM livestock_prod.slaughter_records sr
      JOIN public.tenants t ON t.id = sr.tenant_id
      JOIN animal_health.ref_species rs ON rs.id = sr.species_id
      WHERE rs.code ILIKE '%poultry%'
         OR rs.code ILIKE '%chicken%'
         OR rs.code ILIKE '%GAL%'
         OR rs.name::text ILIKE '%poultry%'
         OR rs.name::text ILIKE '%chicken%'
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // hpai-alerts — COUNT health events for HPAI disease
  {
    code: 'hpai-alerts',
    source: 'animal_health.health_events',
    sql: `
      SELECT EXTRACT(YEAR FROM he.date_suspicion)::int AS year,
             EXTRACT(MONTH FROM he.date_suspicion)::int AS month,
             NULL::int AS quarter, t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM animal_health.health_events he
      JOIN public.tenants t ON t.id = he.tenant_id
      JOIN animal_health.ref_diseases rd ON rd.id = he.disease_id
      WHERE rd.code ILIKE '%HPAI%'
         OR rd.code ILIKE '%H5N1%'
         OR rd.code ILIKE '%avian%influenza%'
         OR rd.name::text ILIKE '%HPAI%'
         OR rd.name::text ILIKE '%avian influenza%'
         OR rd.name::text ILIKE '%grippe aviaire%'
      GROUP BY year, month, t.country_code, t.rec_code`,
  },

  // sheep-population — SUM census for sheep (M heads)
  {
    code: 'sheep-population',
    source: 'livestock_prod.livestock_census',
    sql: `
      SELECT lc.year, NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             (SUM(lc.population) / 1000000.0)::float AS value
      FROM livestock_prod.livestock_census lc
      JOIN public.tenants t ON t.id = lc.tenant_id
      JOIN animal_health.ref_species rs ON rs.id = lc.species_id
      WHERE rs.code ILIKE '%sheep%'
         OR rs.code ILIKE '%OVI%'
         OR rs.name::text ILIKE '%sheep%'
         OR rs.name::text ILIKE '%ovin%'
         OR rs.name::text ILIKE '%mouton%'
      GROUP BY lc.year, t.country_code, t.rec_code`,
  },

  // goat-population — SUM census for goats (M heads)
  {
    code: 'goat-population',
    source: 'livestock_prod.livestock_census',
    sql: `
      SELECT lc.year, NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             (SUM(lc.population) / 1000000.0)::float AS value
      FROM livestock_prod.livestock_census lc
      JOIN public.tenants t ON t.id = lc.tenant_id
      JOIN animal_health.ref_species rs ON rs.id = lc.species_id
      WHERE rs.code ILIKE '%goat%'
         OR rs.code ILIKE '%CAP%'
         OR rs.name::text ILIKE '%goat%'
         OR rs.name::text ILIKE '%caprin%'
         OR rs.name::text ILIKE '%chevre%'
         OR rs.name::text ILIKE '%ch%vre%'
      GROUP BY lc.year, t.country_code, t.rec_code`,
  },

  // ppr-vaccination-coverage — AVG coverage for PPR disease vaccination campaigns
  {
    code: 'ppr-vaccination-coverage',
    source: 'animal_health.vaccination_campaigns',
    sql: `
      SELECT EXTRACT(YEAR FROM vc.period_start)::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             AVG(vc.coverage_estimate)::float AS value
      FROM animal_health.vaccination_campaigns vc
      JOIN public.tenants t ON t.id = vc.tenant_id
      JOIN animal_health.ref_diseases rd ON rd.id = vc.disease_id
      WHERE rd.code ILIKE '%PPR%'
         OR rd.name::text ILIKE '%peste des petits%'
         OR rd.name::text ILIKE '%PPR%'
      GROUP BY year, t.country_code, t.rec_code`,
  },

  // small-ruminant-trade — SUM trade_flows for sheep/goat species
  {
    code: 'small-ruminant-trade',
    source: 'trade_sps.trade_flows',
    sql: `
      SELECT EXTRACT(YEAR FROM tf.period_start)::int AS year,
             NULL::int AS month,
             EXTRACT(QUARTER FROM tf.period_start)::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             SUM(tf.quantity)::float AS value
      FROM trade_sps.trade_flows tf
      JOIN public.tenants t ON t.id = tf.tenant_id
      JOIN animal_health.ref_species rs ON rs.id = tf.species_id
      WHERE rs.code ILIKE '%sheep%' OR rs.code ILIKE '%goat%'
         OR rs.code ILIKE '%OVI%' OR rs.code ILIKE '%CAP%'
         OR rs.name::text ILIKE '%sheep%' OR rs.name::text ILIKE '%goat%'
         OR rs.name::text ILIKE '%ovin%' OR rs.name::text ILIKE '%caprin%'
      GROUP BY year, quarter, t.country_code, t.rec_code`,
  },

  // transhumance-corridors — COUNT corridors per country
  {
    code: 'transhumance-corridors',
    source: 'livestock_prod.transhumance_corridors',
    sql: `
      SELECT EXTRACT(YEAR FROM tc.created_at)::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM livestock_prod.transhumance_corridors tc
      JOIN public.tenants t ON t.id = tc.tenant_id
      GROUP BY year, t.country_code, t.rec_code`,
  },

  // cross-border-corridors — COUNT corridors where cross_border = true
  {
    code: 'cross-border-corridors',
    source: 'livestock_prod.transhumance_corridors',
    sql: `
      SELECT EXTRACT(YEAR FROM tc.created_at)::int AS year,
             NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             COUNT(*)::float AS value
      FROM livestock_prod.transhumance_corridors tc
      JOIN public.tenants t ON t.id = tc.tenant_id
      WHERE tc.cross_border = true
      GROUP BY year, t.country_code, t.rec_code`,
  },

  // pastoral-population — SUM census for pastoral/extensive species (cattle + small ruminants + camels)
  {
    code: 'pastoral-population',
    source: 'livestock_prod.livestock_census',
    sql: `
      SELECT lc.year, NULL::int AS month, NULL::int AS quarter,
             t.country_code, t.rec_code, false AS is_continental,
             (SUM(lc.population) / 1000000.0)::float AS value
      FROM livestock_prod.livestock_census lc
      JOIN public.tenants t ON t.id = lc.tenant_id
      JOIN animal_health.ref_species rs ON rs.id = lc.species_id
      WHERE rs.code ILIKE '%cattle%' OR rs.code ILIKE '%BOS%'
         OR rs.code ILIKE '%sheep%' OR rs.code ILIKE '%OVI%'
         OR rs.code ILIKE '%goat%' OR rs.code ILIKE '%CAP%'
         OR rs.code ILIKE '%camel%' OR rs.code ILIKE '%CAM%'
         OR rs.name::text ILIKE '%cattle%' OR rs.name::text ILIKE '%sheep%'
         OR rs.name::text ILIKE '%goat%' OR rs.name::text ILIKE '%camel%'
         OR rs.name::text ILIKE '%bovin%' OR rs.name::text ILIKE '%ovin%'
         OR rs.name::text ILIKE '%caprin%' OR rs.name::text ILIKE '%cam%lin%'
      GROUP BY lc.year, t.country_code, t.rec_code`,
  },

  // rangeland-condition-avg — SKIP: requires climate-env data or external satellite index
  // NOTE: No rangeland condition table exists in the current schema; needs external data source
  // Placeholder: use NULL to indicate this is a manual-entry indicator
  // { code: 'rangeland-condition-avg', ... }

  // meat-self-sufficiency — production / (production + imports - exports) * 100
  {
    code: 'meat-self-sufficiency',
    source: 'livestock_prod.production_records + trade_sps.trade_flows',
    sql: `
      WITH meat_prod AS (
        SELECT EXTRACT(YEAR FROM pr.period_start)::int AS yr,
               t.country_code, t.rec_code,
               SUM(pr.quantity) AS production
        FROM livestock_prod.production_records pr
        JOIN public.tenants t ON t.id = pr.tenant_id
        WHERE pr.product_type ILIKE '%meat%'
        GROUP BY yr, t.country_code, t.rec_code
      ),
      meat_imports AS (
        SELECT EXTRACT(YEAR FROM tf.period_start)::int AS yr,
               t.country_code, t.rec_code,
               SUM(tf.quantity) AS imports
        FROM trade_sps.trade_flows tf
        JOIN public.tenants t ON t.id = tf.tenant_id
        WHERE tf.flow_direction = 'IMPORT'
          AND (tf.commodity ILIKE '%meat%' OR tf.commodity_group ILIKE '%meat%')
        GROUP BY yr, t.country_code, t.rec_code
      ),
      meat_exports AS (
        SELECT EXTRACT(YEAR FROM tf.period_start)::int AS yr,
               t.country_code, t.rec_code,
               SUM(tf.quantity) AS exports
        FROM trade_sps.trade_flows tf
        JOIN public.tenants t ON t.id = tf.tenant_id
        WHERE tf.flow_direction = 'EXPORT'
          AND (tf.commodity ILIKE '%meat%' OR tf.commodity_group ILIKE '%meat%')
        GROUP BY yr, t.country_code, t.rec_code
      )
      SELECT p.yr AS year, NULL::int AS month, NULL::int AS quarter,
             p.country_code, p.rec_code, false AS is_continental,
             (100.0 * p.production / NULLIF(p.production + COALESCE(i.imports, 0) - COALESCE(e.exports, 0), 0))::float AS value
      FROM meat_prod p
      LEFT JOIN meat_imports i ON i.yr = p.yr
        AND COALESCE(i.country_code, '') = COALESCE(p.country_code, '')
        AND COALESCE(i.rec_code, '') = COALESCE(p.rec_code, '')
      LEFT JOIN meat_exports e ON e.yr = p.yr
        AND COALESCE(e.country_code, '') = COALESCE(p.country_code, '')
        AND COALESCE(e.rec_code, '') = COALESCE(p.rec_code, '')
      WHERE p.production > 0`,
  },

  // milk-self-sufficiency — production / (production + imports - exports) * 100
  {
    code: 'milk-self-sufficiency',
    source: 'livestock_prod.production_records + trade_sps.trade_flows',
    sql: `
      WITH milk_prod AS (
        SELECT EXTRACT(YEAR FROM pr.period_start)::int AS yr,
               t.country_code, t.rec_code,
               SUM(pr.quantity) AS production
        FROM livestock_prod.production_records pr
        JOIN public.tenants t ON t.id = pr.tenant_id
        WHERE pr.product_type ILIKE '%milk%' OR pr.product_type ILIKE '%dairy%'
        GROUP BY yr, t.country_code, t.rec_code
      ),
      milk_imports AS (
        SELECT EXTRACT(YEAR FROM tf.period_start)::int AS yr,
               t.country_code, t.rec_code,
               SUM(tf.quantity) AS imports
        FROM trade_sps.trade_flows tf
        JOIN public.tenants t ON t.id = tf.tenant_id
        WHERE tf.flow_direction = 'IMPORT'
          AND (tf.commodity ILIKE '%milk%' OR tf.commodity ILIKE '%dairy%'
               OR tf.commodity_group ILIKE '%dairy%')
        GROUP BY yr, t.country_code, t.rec_code
      ),
      milk_exports AS (
        SELECT EXTRACT(YEAR FROM tf.period_start)::int AS yr,
               t.country_code, t.rec_code,
               SUM(tf.quantity) AS exports
        FROM trade_sps.trade_flows tf
        JOIN public.tenants t ON t.id = tf.tenant_id
        WHERE tf.flow_direction = 'EXPORT'
          AND (tf.commodity ILIKE '%milk%' OR tf.commodity ILIKE '%dairy%'
               OR tf.commodity_group ILIKE '%dairy%')
        GROUP BY yr, t.country_code, t.rec_code
      )
      SELECT p.yr AS year, NULL::int AS month, NULL::int AS quarter,
             p.country_code, p.rec_code, false AS is_continental,
             (100.0 * p.production / NULLIF(p.production + COALESCE(i.imports, 0) - COALESCE(e.exports, 0), 0))::float AS value
      FROM milk_prod p
      LEFT JOIN milk_imports i ON i.yr = p.yr
        AND COALESCE(i.country_code, '') = COALESCE(p.country_code, '')
        AND COALESCE(i.rec_code, '') = COALESCE(p.rec_code, '')
      LEFT JOIN milk_exports e ON e.yr = p.yr
        AND COALESCE(e.country_code, '') = COALESCE(p.country_code, '')
        AND COALESCE(e.rec_code, '') = COALESCE(p.rec_code, '')
      WHERE p.production > 0`,
  },

  // fish-self-sufficiency — fish production / (production + imports - exports) * 100
  // NOTE: Uses fisheries schema if available, else production_records with fish product type
  {
    code: 'fish-self-sufficiency',
    source: 'livestock_prod.production_records + trade_sps.trade_flows',
    sql: `
      WITH fish_prod AS (
        SELECT EXTRACT(YEAR FROM pr.period_start)::int AS yr,
               t.country_code, t.rec_code,
               SUM(pr.quantity) AS production
        FROM livestock_prod.production_records pr
        JOIN public.tenants t ON t.id = pr.tenant_id
        WHERE pr.product_type ILIKE '%fish%' OR pr.product_type ILIKE '%poisson%'
        GROUP BY yr, t.country_code, t.rec_code
      ),
      fish_imports AS (
        SELECT EXTRACT(YEAR FROM tf.period_start)::int AS yr,
               t.country_code, t.rec_code,
               SUM(tf.quantity) AS imports
        FROM trade_sps.trade_flows tf
        JOIN public.tenants t ON t.id = tf.tenant_id
        WHERE tf.flow_direction = 'IMPORT'
          AND (tf.commodity ILIKE '%fish%' OR tf.commodity_group ILIKE '%fish%')
        GROUP BY yr, t.country_code, t.rec_code
      ),
      fish_exports AS (
        SELECT EXTRACT(YEAR FROM tf.period_start)::int AS yr,
               t.country_code, t.rec_code,
               SUM(tf.quantity) AS exports
        FROM trade_sps.trade_flows tf
        JOIN public.tenants t ON t.id = tf.tenant_id
        WHERE tf.flow_direction = 'EXPORT'
          AND (tf.commodity ILIKE '%fish%' OR tf.commodity_group ILIKE '%fish%')
        GROUP BY yr, t.country_code, t.rec_code
      )
      SELECT p.yr AS year, NULL::int AS month, NULL::int AS quarter,
             p.country_code, p.rec_code, false AS is_continental,
             (100.0 * p.production / NULLIF(p.production + COALESCE(i.imports, 0) - COALESCE(e.exports, 0), 0))::float AS value
      FROM fish_prod p
      LEFT JOIN fish_imports i ON i.yr = p.yr
        AND COALESCE(i.country_code, '') = COALESCE(p.country_code, '')
        AND COALESCE(i.rec_code, '') = COALESCE(p.rec_code, '')
      LEFT JOIN fish_exports e ON e.yr = p.yr
        AND COALESCE(e.country_code, '') = COALESCE(p.country_code, '')
        AND COALESCE(e.rec_code, '') = COALESCE(p.rec_code, '')
      WHERE p.production > 0`,
  },
];

// =============================================================================
// NOTE: The following indicators are SKIPPED (not auto-computable from domain data)
// =============================================================================
// Governance:
//   - quality-pass-rate, timeliness-rate, countries-reporting, total-submissions
//   - pending-l1, pending-l2, pending-l3, validated-l4 (require workflow state queries)
//   - rec-data-completeness (composite cross-domain metric)
//   - animal-health-score, environment-score, capacity-score (composite scores)
//
// Livestock:
//   - rangeland-condition-avg (requires external satellite/climate data, no DB table)
// =============================================================================

// Combine all queries
const QUERIES: IndicatorQuery[] = [
  ...GOVERNANCE_QUERIES,
  ...ANIMAL_HEALTH_QUERIES,
  ...LIVESTOCK_QUERIES,
  ...QUERIES_PART2,
];

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  console.log('=== Seed Indicator Values from Domain Data ===');
  console.log(`    All domains: Governance + Animal Health + Livestock + Trade + Fisheries + Wildlife + Climate + Apiculture`);
  console.log(`    Total queries: ${QUERIES.length}\n`);

  // Load indicator IDs by code
  const { rows: indicators } = await pool.query(
    'SELECT id, code FROM analytics.indicators WHERE active = true',
  );
  const idMap = new Map(indicators.map((i: any) => [i.code, i.id]));
  console.log(`Loaded ${idMap.size} indicator definitions\n`);

  let totalValues = 0;
  let errors = 0;
  let skipped = 0;

  for (const q of QUERIES) {
    const indicatorId = idMap.get(q.code);
    if (!indicatorId) {
      console.log(`  [SKIP] ${q.code} -- not in indicators table`);
      skipped++;
      continue;
    }

    try {
      const { rows } = await pool.query(q.sql);
      if (rows.length === 0) {
        console.log(`  [EMPTY] ${q.code} -- 0 rows from ${q.source}`);
        continue;
      }

      for (const row of rows) {
        await pool.query(
          `INSERT INTO analytics.indicator_values
            (id, indicator_id, year, month, quarter, country_code, rec_code, is_continental, value, source, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
           ON CONFLICT ON CONSTRAINT uq_indicator_value
           DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, updated_at = NOW()`,
          [
            indicatorId,
            row.year,
            row.month || null,
            row.quarter || null,
            row.country_code || null,
            row.rec_code || null,
            row.is_continental ?? false,
            row.value,
            q.source,
          ],
        );
      }
      totalValues += rows.length;
      console.log(`  [OK] ${q.code} -- ${rows.length} values from ${q.source}`);
    } catch (err: any) {
      errors++;
      console.log(`  [ERR] ${q.code} -- ${err.message?.substring(0, 120)}`);
    }
  }

  // -------------------------------------------------------------------------
  // Continental aggregation pass
  // -------------------------------------------------------------------------
  console.log('\n--- Continental aggregation ---');
  try {
    const res = await pool.query(`
      INSERT INTO analytics.indicator_values
        (id, indicator_id, year, month, quarter, country_code, rec_code, is_continental, value, source, created_at, updated_at)
      SELECT gen_random_uuid(), iv.indicator_id, iv.year, iv.month, iv.quarter,
             NULL, NULL, true,
             CASE WHEN i.aggregation IN ('SUM','COUNT') THEN SUM(iv.value)
                  WHEN i.aggregation = 'AVERAGE' THEN AVG(iv.value)
                  WHEN i.aggregation = 'MAX' THEN MAX(iv.value)
                  WHEN i.aggregation = 'MIN' THEN MIN(iv.value)
                  ELSE AVG(iv.value)
             END,
             'auto-continental', NOW(), NOW()
      FROM analytics.indicator_values iv
      JOIN analytics.indicators i ON i.id = iv.indicator_id
      WHERE iv.country_code IS NOT NULL AND iv.is_continental = false
      GROUP BY iv.indicator_id, iv.year, iv.month, iv.quarter, i.aggregation
      ON CONFLICT ON CONSTRAINT uq_indicator_value
      DO UPDATE SET value = EXCLUDED.value, source = 'auto-continental', updated_at = NOW()
    `);
    console.log(`  [OK] Continental aggregation done (${res.rowCount} rows)`);
  } catch (err: any) {
    console.log(`  [ERR] Continental: ${err.message?.substring(0, 120)}`);
  }

  // -------------------------------------------------------------------------
  // REC aggregation pass
  // -------------------------------------------------------------------------
  console.log('\n--- REC aggregation ---');
  try {
    const res = await pool.query(`
      INSERT INTO analytics.indicator_values
        (id, indicator_id, year, month, quarter, country_code, rec_code, is_continental, value, source, created_at, updated_at)
      SELECT gen_random_uuid(), iv.indicator_id, iv.year, iv.month, iv.quarter,
             NULL, iv.rec_code, false,
             CASE WHEN i.aggregation IN ('SUM','COUNT') THEN SUM(iv.value)
                  WHEN i.aggregation = 'AVERAGE' THEN AVG(iv.value)
                  ELSE AVG(iv.value)
             END,
             'auto-rec', NOW(), NOW()
      FROM analytics.indicator_values iv
      JOIN analytics.indicators i ON i.id = iv.indicator_id
      WHERE iv.country_code IS NOT NULL AND iv.rec_code IS NOT NULL AND iv.is_continental = false
      GROUP BY iv.indicator_id, iv.year, iv.month, iv.quarter, iv.rec_code, i.aggregation
      ON CONFLICT ON CONSTRAINT uq_indicator_value
      DO UPDATE SET value = EXCLUDED.value, source = 'auto-rec', updated_at = NOW()
    `);
    console.log(`  [OK] REC aggregation done (${res.rowCount} rows)`);
  } catch (err: any) {
    console.log(`  [ERR] REC: ${err.message?.substring(0, 120)}`);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\n=== Done ===`);
  console.log(`  Total values inserted/updated: ${totalValues}`);
  console.log(`  Indicators skipped (not in DB): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Queries executed: ${QUERIES.length - skipped}`);

  await pool.end();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
