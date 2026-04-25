-- Materialized view: analytics.mv_indicator_values_enriched
-- Purpose: Denormalized view for BI tools (Superset, Metabase) — joins indicator values
-- with indicator definitions and types for efficient dashboard queries.
-- Refresh strategy: REFRESH MATERIALIZED VIEW CONCURRENTLY after bulk imports or on schedule.

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_indicator_values_enriched AS
SELECT
  iv.id,
  i.code AS indicator_code,
  i.name_fr AS indicator_name_fr,
  i.name_en AS indicator_name_en,
  it.code AS type_code,
  it.label_fr AS type_label_fr,
  i.unit,
  iv.year,
  iv.month,
  iv.quarter,
  iv.country_code,
  iv.rec_code,
  iv.is_continental,
  iv.value,
  iv.source AS value_source,
  iv.created_at
FROM analytics.indicator_values iv
JOIN analytics.indicators i ON iv.indicator_id = i.id
JOIN analytics.indicator_types it ON i.type_code = it.code
WHERE i.active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_iv_unique
  ON analytics.mv_indicator_values_enriched (id);

CREATE INDEX IF NOT EXISTS idx_mv_iv_lookup
  ON analytics.mv_indicator_values_enriched (indicator_code, year, country_code);
