/**
 * seed-indicator-values-part2.ts
 * SQL queries for Trade, Fisheries, Wildlife, Climate, Apiculture indicator values.
 * Imported by seed-indicator-values.ts
 */

export interface IndicatorQuery {
  code: string;
  sql: string;
  source: string;
}

export const QUERIES_PART2: IndicatorQuery[] = [
  // =========================================================================
  // TRADE & SPS (7 indicators + 1 skipped)
  // =========================================================================

  {
    code: 'total-trade-volume',
    source: 'trade_sps.trade_flows',
    sql: `
      SELECT
        EXTRACT(YEAR FROM tf.period_start)::int AS year,
        EXTRACT(MONTH FROM tf.period_start)::int AS month,
        EXTRACT(QUARTER FROM tf.period_start)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        SUM(tf.quantity)::float AS value
      FROM trade_sps.trade_flows tf
      JOIN public.tenants t ON t.id = tf.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'trade-volume',
    source: 'trade_sps.trade_flows',
    sql: `
      SELECT
        EXTRACT(YEAR FROM tf.period_start)::int AS year,
        EXTRACT(MONTH FROM tf.period_start)::int AS month,
        EXTRACT(QUARTER FROM tf.period_start)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        SUM(tf.quantity)::float AS value
      FROM trade_sps.trade_flows tf
      JOIN public.tenants t ON t.id = tf.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'trade-balance',
    source: 'trade_sps.trade_flows',
    sql: `
      SELECT
        EXTRACT(YEAR FROM tf.period_start)::int AS year,
        EXTRACT(MONTH FROM tf.period_start)::int AS month,
        EXTRACT(QUARTER FROM tf.period_start)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        SUM(CASE WHEN tf.flow_direction = 'EXPORT' THEN tf.value_fob ELSE -tf.value_fob END)::float AS value
      FROM trade_sps.trade_flows tf
      JOIN public.tenants t ON t.id = tf.tenant_id
      WHERE tf.value_fob IS NOT NULL
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'sps-certificates-issued',
    source: 'trade_sps.sps_certificates',
    sql: `
      SELECT
        EXTRACT(YEAR FROM sc.certified_at)::int AS year,
        EXTRACT(MONTH FROM sc.certified_at)::int AS month,
        EXTRACT(QUARTER FROM sc.certified_at)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(*)::float AS value
      FROM trade_sps.sps_certificates sc
      JOIN public.tenants t ON t.id = sc.tenant_id
      WHERE sc.status = 'ISSUED'
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'sps-compliance-rate',
    source: 'trade_sps.sps_certificates',
    sql: `
      SELECT
        EXTRACT(YEAR FROM sc.inspection_date)::int AS year,
        EXTRACT(MONTH FROM sc.inspection_date)::int AS month,
        EXTRACT(QUARTER FROM sc.inspection_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        (COUNT(*) FILTER (WHERE sc.inspection_result = 'PASS')::float / NULLIF(COUNT(*)::float, 0) * 100)::float AS value
      FROM trade_sps.sps_certificates sc
      JOIN public.tenants t ON t.id = sc.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'active-markets',
    source: 'trade_sps.market_prices',
    sql: `
      SELECT
        EXTRACT(YEAR FROM mp.date)::int AS year,
        EXTRACT(MONTH FROM mp.date)::int AS month,
        EXTRACT(QUARTER FROM mp.date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(DISTINCT mp.market_id)::float AS value
      FROM trade_sps.market_prices mp
      JOIN public.tenants t ON t.id = mp.tenant_id
      WHERE mp.date > NOW() - INTERVAL '90 days'
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'commodities-tracked',
    source: 'trade_sps.market_prices',
    sql: `
      SELECT
        EXTRACT(YEAR FROM mp.date)::int AS year,
        EXTRACT(MONTH FROM mp.date)::int AS month,
        EXTRACT(QUARTER FROM mp.date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(DISTINCT mp.commodity)::float AS value
      FROM trade_sps.market_prices mp
      JOIN public.tenants t ON t.id = mp.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  // SKIPPED: price-alerts — requires threshold configuration per commodity/market.
  // Cannot be computed from raw market_prices without a reference threshold table.

  // =========================================================================
  // FISHERIES (11 indicators)
  // =========================================================================

  {
    code: 'total-captures',
    source: 'fisheries.fish_captures',
    sql: `
      SELECT
        EXTRACT(YEAR FROM fc.capture_date)::int AS year,
        EXTRACT(MONTH FROM fc.capture_date)::int AS month,
        EXTRACT(QUARTER FROM fc.capture_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        (SUM(fc.quantity_kg) / 1000)::float AS value
      FROM fisheries.fish_captures fc
      JOIN public.tenants t ON t.id = fc.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'total-capture-tonnes',
    source: 'fisheries.fish_captures',
    sql: `
      SELECT
        EXTRACT(YEAR FROM fc.capture_date)::int AS year,
        EXTRACT(MONTH FROM fc.capture_date)::int AS month,
        EXTRACT(QUARTER FROM fc.capture_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        (SUM(fc.quantity_kg) / 1000)::float AS value
      FROM fisheries.fish_captures fc
      JOIN public.tenants t ON t.id = fc.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'active-vessels',
    source: 'fisheries.fishing_vessels',
    sql: `
      SELECT
        EXTRACT(YEAR FROM fv.created_at)::int AS year,
        EXTRACT(MONTH FROM fv.created_at)::int AS month,
        EXTRACT(QUARTER FROM fv.created_at)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(*)::float AS value
      FROM fisheries.fishing_vessels fv
      JOIN public.tenants t ON t.id = fv.tenant_id
      WHERE fv.is_active = true
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'main-species-count',
    source: 'fisheries.fish_captures',
    sql: `
      SELECT
        EXTRACT(YEAR FROM fc.capture_date)::int AS year,
        EXTRACT(MONTH FROM fc.capture_date)::int AS month,
        EXTRACT(QUARTER FROM fc.capture_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(DISTINCT fc.species_id)::float AS value
      FROM fisheries.fish_captures fc
      JOIN public.tenants t ON t.id = fc.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'cpue-average',
    source: 'fisheries.fish_captures + fisheries.fishing_efforts',
    sql: `
      SELECT
        EXTRACT(YEAR FROM fc.capture_date)::int AS year,
        EXTRACT(MONTH FROM fc.capture_date)::int AS month,
        EXTRACT(QUARTER FROM fc.capture_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        (SUM(fc.quantity_kg) / NULLIF(SUM(fe.effort_value), 0))::float AS value
      FROM fisheries.fish_captures fc
      JOIN fisheries.fishing_efforts fe ON fe.capture_id = fc.id
      JOIN public.tenants t ON t.id = fc.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'aquaculture-production-tonnes',
    source: 'fisheries.aquaculture_production',
    sql: `
      SELECT
        EXTRACT(YEAR FROM ap.harvest_date)::int AS year,
        EXTRACT(MONTH FROM ap.harvest_date)::int AS month,
        EXTRACT(QUARTER FROM ap.harvest_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        (SUM(ap.quantity_kg) / 1000)::float AS value
      FROM fisheries.aquaculture_production ap
      JOIN public.tenants t ON t.id = ap.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'active-farms',
    source: 'fisheries.aquaculture_farms',
    sql: `
      SELECT
        EXTRACT(YEAR FROM af.created_at)::int AS year,
        EXTRACT(MONTH FROM af.created_at)::int AS month,
        EXTRACT(QUARTER FROM af.created_at)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(*)::float AS value
      FROM fisheries.aquaculture_farms af
      JOIN public.tenants t ON t.id = af.tenant_id
      WHERE af.is_active = true
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'fcr-average',
    source: 'fisheries.aquaculture_production',
    sql: `
      SELECT
        EXTRACT(YEAR FROM ap.harvest_date)::int AS year,
        EXTRACT(MONTH FROM ap.harvest_date)::int AS month,
        EXTRACT(QUARTER FROM ap.harvest_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        AVG(ap.fcr)::float AS value
      FROM fisheries.aquaculture_production ap
      JOIN public.tenants t ON t.id = ap.tenant_id
      WHERE ap.fcr IS NOT NULL
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'survival-rate-avg',
    source: 'fisheries.aquaculture_production',
    sql: `
      SELECT
        EXTRACT(YEAR FROM ap.harvest_date)::int AS year,
        EXTRACT(MONTH FROM ap.harvest_date)::int AS month,
        EXTRACT(QUARTER FROM ap.harvest_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        AVG(ap.survival_rate)::float AS value
      FROM fisheries.aquaculture_production ap
      JOIN public.tenants t ON t.id = ap.tenant_id
      WHERE ap.survival_rate IS NOT NULL
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'fi-survival-rate',
    source: 'fisheries.aquaculture_production',
    sql: `
      SELECT
        EXTRACT(YEAR FROM ap.harvest_date)::int AS year,
        EXTRACT(MONTH FROM ap.harvest_date)::int AS month,
        EXTRACT(QUARTER FROM ap.harvest_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        AVG(ap.survival_rate)::float AS value
      FROM fisheries.aquaculture_production ap
      JOIN public.tenants t ON t.id = ap.tenant_id
      WHERE ap.survival_rate IS NOT NULL
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'fish-production-total',
    source: 'fisheries.fish_captures + fisheries.aquaculture_production',
    sql: `
      SELECT
        year,
        month,
        quarter,
        country_code,
        rec_code,
        is_continental,
        SUM(value)::float AS value
      FROM (
        SELECT
          EXTRACT(YEAR FROM fc.capture_date)::int AS year,
          EXTRACT(MONTH FROM fc.capture_date)::int AS month,
          EXTRACT(QUARTER FROM fc.capture_date)::int AS quarter,
          t.country_code,
          t.rec_code,
          CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
          (SUM(fc.quantity_kg) / 1000)::float AS value
        FROM fisheries.fish_captures fc
        JOIN public.tenants t ON t.id = fc.tenant_id
        GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
        UNION ALL
        SELECT
          EXTRACT(YEAR FROM ap.harvest_date)::int AS year,
          EXTRACT(MONTH FROM ap.harvest_date)::int AS month,
          EXTRACT(QUARTER FROM ap.harvest_date)::int AS quarter,
          t.country_code,
          t.rec_code,
          CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
          (SUM(ap.quantity_kg) / 1000)::float AS value
        FROM fisheries.aquaculture_production ap
        JOIN public.tenants t ON t.id = ap.tenant_id
        GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
      ) combined
      GROUP BY year, month, quarter, country_code, rec_code, is_continental
    `,
  },

  // =========================================================================
  // WILDLIFE (9 indicators)
  // =========================================================================

  {
    code: 'species-monitored',
    source: 'wildlife.wildlife_inventories',
    sql: `
      SELECT
        EXTRACT(YEAR FROM wi.survey_date)::int AS year,
        EXTRACT(MONTH FROM wi.survey_date)::int AS month,
        EXTRACT(QUARTER FROM wi.survey_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(DISTINCT wi.species_id)::float AS value
      FROM wildlife.wildlife_inventories wi
      JOIN public.tenants t ON t.id = wi.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'protected-areas',
    source: 'wildlife.protected_areas',
    sql: `
      SELECT
        EXTRACT(YEAR FROM pa.created_at)::int AS year,
        EXTRACT(MONTH FROM pa.created_at)::int AS month,
        EXTRACT(QUARTER FROM pa.created_at)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        SUM(pa.area_km2)::float AS value
      FROM wildlife.protected_areas pa
      JOIN public.tenants t ON t.id = pa.tenant_id
      WHERE pa.is_active = true
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'protected-area-km2',
    source: 'wildlife.protected_areas',
    sql: `
      SELECT
        EXTRACT(YEAR FROM pa.created_at)::int AS year,
        EXTRACT(MONTH FROM pa.created_at)::int AS month,
        EXTRACT(QUARTER FROM pa.created_at)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        SUM(pa.area_km2)::float AS value
      FROM wildlife.protected_areas pa
      JOIN public.tenants t ON t.id = pa.tenant_id
      WHERE pa.is_active = true
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'cites-permits-active',
    source: 'wildlife.cites_permits',
    sql: `
      SELECT
        EXTRACT(YEAR FROM cp.issue_date)::int AS year,
        EXTRACT(MONTH FROM cp.issue_date)::int AS month,
        EXTRACT(QUARTER FROM cp.issue_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(*)::float AS value
      FROM wildlife.cites_permits cp
      JOIN public.tenants t ON t.id = cp.tenant_id
      WHERE cp.status = 'ISSUED' AND cp.expiry_date > NOW()
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'poaching-incidents',
    source: 'wildlife.wildlife_crimes',
    sql: `
      SELECT
        EXTRACT(YEAR FROM wc.incident_date)::int AS year,
        EXTRACT(MONTH FROM wc.incident_date)::int AS month,
        EXTRACT(QUARTER FROM wc.incident_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(*)::float AS value
      FROM wildlife.wildlife_crimes wc
      JOIN public.tenants t ON t.id = wc.tenant_id
      WHERE wc.crime_type = 'POACHING'
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'cites-export-permits',
    source: 'wildlife.cites_permits',
    sql: `
      SELECT
        EXTRACT(YEAR FROM cp.issue_date)::int AS year,
        EXTRACT(MONTH FROM cp.issue_date)::int AS month,
        EXTRACT(QUARTER FROM cp.issue_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(*)::float AS value
      FROM wildlife.cites_permits cp
      JOIN public.tenants t ON t.id = cp.tenant_id
      WHERE cp.permit_type = 'EXPORT'
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'cites-import-permits',
    source: 'wildlife.cites_permits',
    sql: `
      SELECT
        EXTRACT(YEAR FROM cp.issue_date)::int AS year,
        EXTRACT(MONTH FROM cp.issue_date)::int AS month,
        EXTRACT(QUARTER FROM cp.issue_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(*)::float AS value
      FROM wildlife.cites_permits cp
      JOIN public.tenants t ON t.id = cp.tenant_id
      WHERE cp.permit_type = 'IMPORT'
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'permits-expired',
    source: 'wildlife.cites_permits',
    sql: `
      SELECT
        EXTRACT(YEAR FROM cp.expiry_date)::int AS year,
        EXTRACT(MONTH FROM cp.expiry_date)::int AS month,
        EXTRACT(QUARTER FROM cp.expiry_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(*)::float AS value
      FROM wildlife.cites_permits cp
      JOIN public.tenants t ON t.id = cp.tenant_id
      WHERE cp.status = 'EXPIRED' OR cp.expiry_date < NOW()
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'seizure-volume',
    source: 'wildlife.wildlife_crimes',
    sql: `
      SELECT
        EXTRACT(YEAR FROM wc.incident_date)::int AS year,
        EXTRACT(MONTH FROM wc.incident_date)::int AS month,
        EXTRACT(QUARTER FROM wc.incident_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        SUM(wc.seizure_quantity)::float AS value
      FROM wildlife.wildlife_crimes wc
      JOIN public.tenants t ON t.id = wc.tenant_id
      WHERE wc.seizure_quantity IS NOT NULL
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  // =========================================================================
  // CLIMATE & ENVIRONMENT (8 indicators)
  // =========================================================================

  {
    code: 'zones-severe-water-stress',
    source: 'climate_env.water_stress_indices',
    sql: `
      SELECT
        EXTRACT(YEAR FROM wsi.created_at)::int AS year,
        EXTRACT(MONTH FROM wsi.created_at)::int AS month,
        EXTRACT(QUARTER FROM wsi.created_at)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(*)::float AS value
      FROM climate_env.water_stress_indices wsi
      JOIN public.tenants t ON t.id = wsi.tenant_id
      WHERE wsi.index > 70
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'climate-hotspots',
    source: 'climate_env.environmental_hotspots',
    sql: `
      SELECT
        EXTRACT(YEAR FROM eh.detected_date)::int AS year,
        EXTRACT(MONTH FROM eh.detected_date)::int AS month,
        EXTRACT(QUARTER FROM eh.detected_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(*)::float AS value
      FROM climate_env.environmental_hotspots eh
      JOIN public.tenants t ON t.id = eh.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'ndvi-average',
    source: 'climate_env.rangeland_conditions',
    sql: `
      SELECT
        EXTRACT(YEAR FROM rc.assessment_date)::int AS year,
        EXTRACT(MONTH FROM rc.assessment_date)::int AS month,
        EXTRACT(QUARTER FROM rc.assessment_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        AVG(rc.ndvi_index)::float AS value
      FROM climate_env.rangeland_conditions rc
      JOIN public.tenants t ON t.id = rc.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'ce-severe-degradation-pct',
    source: 'climate_env.rangeland_conditions',
    sql: `
      SELECT
        EXTRACT(YEAR FROM rc.assessment_date)::int AS year,
        EXTRACT(MONTH FROM rc.assessment_date)::int AS month,
        EXTRACT(QUARTER FROM rc.assessment_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        (COUNT(*) FILTER (WHERE rc.degradation_level = 'SEVERE')::float / NULLIF(COUNT(*)::float, 0) * 100)::float AS value
      FROM climate_env.rangeland_conditions rc
      JOIN public.tenants t ON t.id = rc.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'water-stress-avg-index',
    source: 'climate_env.water_stress_indices',
    sql: `
      SELECT
        EXTRACT(YEAR FROM wsi.created_at)::int AS year,
        EXTRACT(MONTH FROM wsi.created_at)::int AS month,
        EXTRACT(QUARTER FROM wsi.created_at)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        AVG(wsi.index)::float AS value
      FROM climate_env.water_stress_indices wsi
      JOIN public.tenants t ON t.id = wsi.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'irrigated-area-pct',
    source: 'climate_env.water_stress_indices',
    sql: `
      SELECT
        EXTRACT(YEAR FROM wsi.created_at)::int AS year,
        EXTRACT(MONTH FROM wsi.created_at)::int AS month,
        EXTRACT(QUARTER FROM wsi.created_at)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        AVG(wsi.irrigated_area_pct)::float AS value
      FROM climate_env.water_stress_indices wsi
      JOIN public.tenants t ON t.id = wsi.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'zones-scarce',
    source: 'climate_env.water_stress_indices',
    sql: `
      SELECT
        EXTRACT(YEAR FROM wsi.created_at)::int AS year,
        EXTRACT(MONTH FROM wsi.created_at)::int AS month,
        EXTRACT(QUARTER FROM wsi.created_at)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(*)::float AS value
      FROM climate_env.water_stress_indices wsi
      JOIN public.tenants t ON t.id = wsi.tenant_id
      WHERE wsi.water_availability = 'SCARCE'
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'zones-adequate',
    source: 'climate_env.water_stress_indices',
    sql: `
      SELECT
        EXTRACT(YEAR FROM wsi.created_at)::int AS year,
        EXTRACT(MONTH FROM wsi.created_at)::int AS month,
        EXTRACT(QUARTER FROM wsi.created_at)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(*)::float AS value
      FROM climate_env.water_stress_indices wsi
      JOIN public.tenants t ON t.id = wsi.tenant_id
      WHERE wsi.water_availability = 'ADEQUATE'
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  // =========================================================================
  // APICULTURE (4 indicators)
  // =========================================================================

  {
    code: 'apiaries-active',
    source: 'apiculture.apiaries',
    sql: `
      SELECT
        EXTRACT(YEAR FROM a.created_at)::int AS year,
        EXTRACT(MONTH FROM a.created_at)::int AS month,
        EXTRACT(QUARTER FROM a.created_at)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(*)::float AS value
      FROM apiculture.apiaries a
      JOIN public.tenants t ON t.id = a.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'honey-production',
    source: 'apiculture.honey_production',
    sql: `
      SELECT
        EXTRACT(YEAR FROM hp.harvest_date)::int AS year,
        EXTRACT(MONTH FROM hp.harvest_date)::int AS month,
        EXTRACT(QUARTER FROM hp.harvest_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        SUM(hp.quantity)::float AS value
      FROM apiculture.honey_production hp
      JOIN public.tenants t ON t.id = hp.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'colony-health-strong-pct',
    source: 'apiculture.colony_health',
    sql: `
      SELECT
        EXTRACT(YEAR FROM ch.inspection_date)::int AS year,
        EXTRACT(MONTH FROM ch.inspection_date)::int AS month,
        EXTRACT(QUARTER FROM ch.inspection_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        (COUNT(*) FILTER (WHERE ch.colony_strength = 'STRONG')::float / NULLIF(COUNT(*)::float, 0) * 100)::float AS value
      FROM apiculture.colony_health ch
      JOIN public.tenants t ON t.id = ch.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },

  {
    code: 'beekeepers-trained',
    source: 'apiculture.beekeeper_training',
    sql: `
      SELECT
        EXTRACT(YEAR FROM bt.completed_date)::int AS year,
        EXTRACT(MONTH FROM bt.completed_date)::int AS month,
        EXTRACT(QUARTER FROM bt.completed_date)::int AS quarter,
        t.country_code,
        t.rec_code,
        CASE WHEN t.level = 'CONTINENTAL' THEN true ELSE false END AS is_continental,
        COUNT(*)::float AS value
      FROM apiculture.beekeeper_training bt
      JOIN public.tenants t ON t.id = bt.tenant_id
      GROUP BY year, month, quarter, t.country_code, t.rec_code, t.level
    `,
  },
];
