#!/usr/bin/env python3
"""
ARIS 4.0 — Create demo assets for Directrice presentation.

Idempotent script that creates:
  1. Multi-target campaign: PPR Sahel 2026 (3 targets)
  2. Composite indicator: PPR_VAX_COVERAGE_WEIGHTED + 3 sources + demo values
  3. Dashboard: "Vue strategique Directrice" (9 widgets)

All SQL blocks use IF EXISTS / IF NOT EXISTS guards for idempotency.

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  python -u _create_demo_assets.py                # staging (default)
  python -u _create_demo_assets.py --env prod      # production
"""
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import step, ssh, VM_USER, VM_PASS

# ── Environment configs ──────────────────────────────────────
ENVS = {
    "staging": {
        "db_host": "10.202.101.148",
        "vm_db": "10.202.101.148",
        "container": "aris-stg-postgres",
        "db_user": "aris",
        "db_pass": "Ar1s_Stg_2024!xK9mZ",
        "db_name": "aris",
    },
    "prod": {
        "db_host": "10.202.101.185",
        "vm_db": "10.202.101.185",
        "container": "aris-postgres",
        "db_user": "aris",
        "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
        "db_name": "aris",
    },
}

# ── SQL blocks ───────────────────────────────────────────────

SQL_CAMPAIGN = r"""
DO $$
DECLARE
  camp_id UUID;
  ah_id UUID;
  lp_id UUID;
BEGIN
  -- Skip if already exists
  IF EXISTS (SELECT 1 FROM public.collection_campaigns WHERE name ILIKE '%PPR%Sahel%') THEN
    RAISE NOTICE 'Demo campaign already exists, skipping';
    RETURN;
  END IF;

  -- Find domains
  SELECT id INTO ah_id FROM governance.domains WHERE code = 'animal-health';
  SELECT id INTO lp_id FROM governance.domains WHERE code = 'livestock-prod';

  IF ah_id IS NULL THEN
    RAISE NOTICE 'Domain animal-health not found, skipping campaign creation';
    RETURN;
  END IF;

  -- Create the campaign
  camp_id := gen_random_uuid();
  INSERT INTO public.collection_campaigns (id, name, description, domain, status, start_date, end_date, created_at, updated_at)
  VALUES (camp_id, 'Surveillance saisonniere PPR 2026 — Sahel',
    'Campagne illustrative multi-cibles couvrant la surveillance, la vaccination et la production de petits ruminants dans la zone sahelienne.',
    'animal-health', 'ACTIVE', '2026-04-01', '2026-06-30', NOW(), NOW());

  -- Create targets
  INSERT INTO public.campaign_targets (id, campaign_id, domain_code, sub_domain_code, is_primary, created_at)
  VALUES
    (gen_random_uuid(), camp_id, 'animal-health', 'SURVEILLANCE', true, NOW()),
    (gen_random_uuid(), camp_id, 'animal-health', 'VACCINATION', false, NOW()),
    (gen_random_uuid(), camp_id, 'livestock-prod', 'SMALL_RUMINANTS', false, NOW());

  RAISE NOTICE 'Demo campaign created: %', camp_id;
END $$;
"""

SQL_INDICATOR = r"""
DO $$
DECLARE
  ind_id UUID;
  ah_id UUID;
BEGIN
  -- Skip if already exists
  IF EXISTS (SELECT 1 FROM analytics.indicators WHERE code = 'PPR_VAX_COVERAGE_WEIGHTED') THEN
    RAISE NOTICE 'Demo indicator already exists, skipping';
    RETURN;
  END IF;

  SELECT id INTO ah_id FROM governance.domains WHERE code = 'animal-health';

  -- Create source indicators if they do not exist
  IF NOT EXISTS (SELECT 1 FROM analytics.indicators WHERE code = 'PPR_VACCINATED_HEADS') THEN
    INSERT INTO analytics.indicators (id, code, type_code, name_fr, name_en, domain_id, scope, measurement_mode, unit, decimal_places, better_is_higher, active, is_public, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PPR_VACCINATED_HEADS', 'IBAR', 'Tetes vaccinees PPR', 'PPR Vaccinated Heads', ah_id, 'CONTINENTAL', 'MANUAL_ENTRY', 'count', 0, true, true, true, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM analytics.indicators WHERE code = 'TOTAL_SMALL_RUMINANTS') THEN
    INSERT INTO analytics.indicators (id, code, type_code, name_fr, name_en, domain_id, scope, measurement_mode, unit, decimal_places, better_is_higher, active, is_public, created_at, updated_at)
    VALUES (gen_random_uuid(), 'TOTAL_SMALL_RUMINANTS', 'FAO', 'Total petits ruminants', 'Total Small Ruminants', ah_id, 'CONTINENTAL', 'MANUAL_ENTRY', 'count', 0, true, true, true, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM analytics.indicators WHERE code = 'LIVESTOCK_DENSITY_FACTOR') THEN
    INSERT INTO analytics.indicators (id, code, type_code, name_fr, name_en, domain_id, scope, measurement_mode, unit, decimal_places, better_is_higher, active, is_public, created_at, updated_at)
    VALUES (gen_random_uuid(), 'LIVESTOCK_DENSITY_FACTOR', 'IBAR', 'Facteur densite cheptel', 'Livestock Density Factor', ah_id, 'CONTINENTAL', 'MANUAL_ENTRY', 'ratio', 2, true, true, true, NOW(), NOW());
  END IF;

  -- Create composite indicator
  ind_id := gen_random_uuid();
  INSERT INTO analytics.indicators (id, code, type_code, name_fr, name_en, description_fr, description_en, domain_id, scope, measurement_mode, unit, decimal_places, better_is_higher, target_value, active, is_public, created_at, updated_at)
  VALUES (ind_id, 'PPR_VAX_COVERAGE_WEIGHTED', 'IBAR',
    'Taux de couverture vaccinale PPR pondere par densite de cheptel',
    'PPR vaccination coverage weighted by livestock density',
    'Indicateur composite combinant la couverture vaccinale brute avec un facteur de ponderation base sur la densite de cheptel.',
    'Composite indicator combining raw vaccination coverage with a weighting factor based on livestock density.',
    ah_id, 'CONTINENTAL', 'COMPOSITE_FORMULA', 'percent', 2, true, 80, true, true, NOW(), NOW());

  -- Create formula
  INSERT INTO analytics.indicator_formulas (id, indicator_id, expression, is_validated, validated_at, created_at, updated_at)
  VALUES (gen_random_uuid(), ind_id,
    '({{indicator:PPR_VACCINATED_HEADS}} / {{indicator:TOTAL_SMALL_RUMINANTS}}) * 100 * {{indicator:LIVESTOCK_DENSITY_FACTOR}}',
    true, NOW(), NOW(), NOW());

  -- Insert demo values for 5 Sahel countries, 2024-2025
  INSERT INTO analytics.indicator_values (id, indicator_id, year, country_code, value, source, created_at, updated_at)
  SELECT gen_random_uuid(), i.id, y.yr, c.code,
    CASE WHEN i.code = 'PPR_VACCINATED_HEADS' THEN (random() * 500000 + 100000)::int
         WHEN i.code = 'TOTAL_SMALL_RUMINANTS' THEN (random() * 2000000 + 500000)::int
         WHEN i.code = 'LIVESTOCK_DENSITY_FACTOR' THEN (random() * 0.5 + 0.7)::numeric(4,2)
    END,
    'demo_seed', NOW(), NOW()
  FROM analytics.indicators i
  CROSS JOIN (VALUES (2024), (2025)) AS y(yr)
  CROSS JOIN (VALUES ('ML'), ('BF'), ('NE'), ('TD'), ('MR')) AS c(code)
  WHERE i.code IN ('PPR_VACCINATED_HEADS', 'TOTAL_SMALL_RUMINANTS', 'LIVESTOCK_DENSITY_FACTOR')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Demo indicator created: %', ind_id;
END $$;
"""

SQL_DASHBOARD = r"""
DO $$
DECLARE
  dash_id UUID;
  ah_id UUID;
BEGIN
  SELECT id INTO ah_id FROM governance.domains WHERE code = 'animal-health';

  IF EXISTS (SELECT 1 FROM dashboard_builder.dashboards WHERE title_fr ILIKE '%Vue strategique%Directrice%') THEN
    RAISE NOTICE 'Demo dashboard already exists, skipping';
    RETURN;
  END IF;

  dash_id := gen_random_uuid();
  INSERT INTO dashboard_builder.dashboards (id, ownership, scope, domain_id, title_fr, title_en, description, grid_columns, row_height, is_default, created_at, updated_at)
  VALUES (dash_id, 'USER_OWNED', 'CONTINENTAL', ah_id,
    'Vue strategique Directrice -- Sante animale 2026',
    'Strategic View Director -- Animal Health 2026',
    'Dashboard personnalise pour la demo Directrice', 12, 80, false, NOW(), NOW());

  -- 4 KPI cards (top row)
  INSERT INTO dashboard_builder.dashboard_widgets (id, dashboard_id, type, data_source, grid_x, grid_y, grid_w, grid_h, title_fr, title_en, config, filters, created_at, updated_at) VALUES
  (gen_random_uuid(), dash_id, 'KPI_CARD', 'INDICATOR', 0, 0, 3, 2, 'Cas signales', 'Reported Cases', '{"color":"#C62828"}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  (gen_random_uuid(), dash_id, 'KPI_CARD', 'INDICATOR', 3, 0, 3, 2, 'Pays affectes', 'Affected Countries', '{"color":"#1565C0"}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  (gen_random_uuid(), dash_id, 'KPI_CARD', 'INDICATOR', 6, 0, 3, 2, 'Couverture vaccinale', 'Vaccination Coverage', '{"color":"#2E7D32","unit":"%"}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  (gen_random_uuid(), dash_id, 'KPI_CARD', 'INDICATOR', 9, 0, 3, 2, 'Mortalite moyenne', 'Average Mortality', '{"color":"#E65100","unit":"%"}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  -- Map + Bar chart (middle row)
  (gen_random_uuid(), dash_id, 'MAP_AFRICA', 'KPI_CONTINENTAL', 0, 2, 8, 5, 'Foyers actifs', 'Active Outbreaks', '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  (gen_random_uuid(), dash_id, 'BAR_CHART', 'KPI_CONTINENTAL', 8, 2, 4, 5, 'Top 10 pays', 'Top 10 Countries', '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  -- Line + Stacked bar (lower row)
  (gen_random_uuid(), dash_id, 'LINE_CHART', 'KPI_CONTINENTAL', 0, 7, 6, 4, 'Evolution PPR + FMD (12 mois)', 'PPR + FMD Trend (12 months)', '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  (gen_random_uuid(), dash_id, 'STACKED_BAR', 'KPI_CONTINENTAL', 6, 7, 6, 4, 'Repartition par CER', 'Breakdown by REC', '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  -- Alert feed (bottom)
  (gen_random_uuid(), dash_id, 'ALERT_FEED', 'MANUAL_VALUE', 0, 11, 12, 3, 'Alertes recentes', 'Recent Alerts', '{}'::jsonb, '{}'::jsonb, NOW(), NOW());

  RAISE NOTICE 'Demo dashboard created: % (9 widgets)', dash_id;
END $$;
"""

# ── Helpers ──────────────────────────────────────────────────

def run_sql(env_cfg, label, sql_block):
    """Execute a SQL block via SSH -> docker exec -> psql."""
    step(label)

    container = env_cfg["container"]
    db_user = env_cfg["db_user"]
    db_name = env_cfg["db_name"]

    # Escape single quotes for bash wrapping: replace ' with '\''
    escaped_sql = sql_block.replace("'", "'\\''")

    cmd = (
        f"docker exec {container} "
        f"psql -U {db_user} -d {db_name} "
        f"-c '{escaped_sql}'"
    )

    code, out, err = ssh(env_cfg["vm_db"], cmd, timeout=60)

    # Print output (contains NOTICE messages)
    if out:
        for line in out.strip().splitlines():
            print(f"  {line}")
    if err:
        # Filter sudo noise
        for line in err.strip().splitlines():
            if "[sudo]" not in line and "password" not in line.lower():
                print(f"  {line}")

    if code != 0:
        print(f"  FAILED (exit {code})")
        return False

    print(f"  OK")
    return True


# ── Main ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="ARIS 4.0 — Create demo assets (campaign, indicator, dashboard)"
    )
    parser.add_argument(
        "--env",
        choices=["staging", "prod"],
        default="staging",
        help="Target environment (default: staging)",
    )
    args = parser.parse_args()

    env_cfg = ENVS[args.env]

    print("=" * 60)
    print(f"  ARIS 4.0 — Demo Assets Creation")
    print(f"  Environment: {args.env}")
    print(f"  DB host:     {env_cfg['db_host']}")
    print(f"  Container:   {env_cfg['container']}")
    print("=" * 60)

    results = []

    # Asset 1: Multi-target campaign
    ok = run_sql(env_cfg, "Asset 1: Multi-target campaign (PPR Sahel 2026)", SQL_CAMPAIGN)
    results.append(("Campaign", ok))

    # Asset 2: Composite indicator
    ok = run_sql(env_cfg, "Asset 2: Composite indicator (PPR_VAX_COVERAGE_WEIGHTED)", SQL_INDICATOR)
    results.append(("Indicator", ok))

    # Asset 3: Dashboard Directrice
    ok = run_sql(env_cfg, "Asset 3: Dashboard Vue strategique Directrice", SQL_DASHBOARD)
    results.append(("Dashboard", ok))

    # Summary
    print("\n" + "=" * 60)
    print("  Summary")
    print("=" * 60)
    all_ok = True
    for name, ok in results:
        status = "OK" if ok else "FAILED"
        print(f"  {name:20s} {status}")
        if not ok:
            all_ok = False

    if all_ok:
        print("\n  All demo assets created successfully.")
    else:
        print("\n  Some assets failed. Check output above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
