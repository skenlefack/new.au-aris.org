#!/usr/bin/env python3
"""
ARIS 4.0 — Import 750K+ historical rows into transactional domain tables.

Reads from historical.* tables (populated by the ARIS 3 ETL pipeline) and writes
into the actual service tables:
  - animal_health.health_events       (~448K outbreaks + ~302K zero declarations)
  - animal_health.vaccination_campaigns (~6.3K rows)
  - livestock_prod.livestock_census     (~249 rows)

Runs SQL via SSH → docker exec psql on production PostgreSQL.

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  python -u _import_historical_to_transactional.py              # full import
  python -u _import_historical_to_transactional.py --dry-run    # counts only, no INSERT
  python -u _import_historical_to_transactional.py --step=2     # run only step 2
  python -u _import_historical_to_transactional.py --skip-indicators  # skip indicator recalc
"""
import sys, os, time, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import step, ssh, VM_DB, VM_APP

# ── Constants ────────────────────────────────────────────────────────────────
CONTAINER = "aris-postgres"
DB_USER = "aris"
DB_NAME = "aris"
DB_PASS = "Ar1s_Pr0d_2024!xK9mZ"
DB_HOST = "10.202.101.185"

# System user UUID for created_by / updated_by (SUPER_ADMIN seeded user)
SYSTEM_USER_ID = "00000000-0000-4000-a000-000000000001"

# Placeholder geo_entity_id — will be overridden by country-level geo lookup
# We use the tenant's own geo_entity from master_data.geo_entities
PLACEHOLDER_GEO = "00000000-0000-4000-c000-000000000001"

# Source historical tables (long names from ETL)
TBL_HEALTH = "historical.hdata_animal_health_au_ibar_monthly_animal_health_report_his_mo"
TBL_VACC   = "historical.hdata_animal_health_monthly_vaccination_report_historical_mol9y"
TBL_CENSUS = "historical.hdata_livestock_prod_animal_population_and_composition_histor_m"


def psql(sql, timeout=600):
    """Execute SQL via docker exec psql on VM_DB. Returns (exit_code, stdout, stderr)."""
    # Escape single quotes for the outer bash -c wrapper
    escaped = sql.replace("'", "'\\''")
    cmd = (
        f"docker exec {CONTAINER} psql -U {DB_USER} -d {DB_NAME} "
        f"-c '\\''{ escaped }'\\'' 2>&1"
    )
    return ssh(VM_DB, cmd, timeout=timeout)


def psql_heredoc(sql, timeout=600):
    """Execute multi-line SQL via heredoc to avoid quoting hell."""
    # Write SQL to a temp file inside the container, then execute it
    # This avoids all shell escaping issues
    import base64
    b64 = base64.b64encode(sql.encode()).decode()
    cmd = (
        f"echo '{b64}' | base64 -d > /tmp/_hist_import.sql && "
        f"docker cp /tmp/_hist_import.sql {CONTAINER}:/tmp/_hist_import.sql && "
        f"docker exec {CONTAINER} psql -U {DB_USER} -d {DB_NAME} -f /tmp/_hist_import.sql 2>&1"
    )
    return ssh(VM_DB, cmd, timeout=timeout)


def run_sql(label, sql, timeout=600):
    """Run SQL, print output, return stdout."""
    print(f"\n  >> {label}")
    t0 = time.time()
    code, out, err = psql_heredoc(sql, timeout=timeout)
    elapsed = time.time() - t0
    # Clean sudo noise
    clean = "\n".join(
        l for l in out.splitlines()
        if "[sudo]" not in l and "password for" not in l
    )
    if clean.strip():
        for line in clean.strip().splitlines()[-10:]:
            print(f"     {line}")
    if err and "ERROR" in err:
        print(f"  !! STDERR: {err[:500]}")
    print(f"  -- {elapsed:.1f}s (exit={code})")
    return clean


# ══════════════════════════════════════════════════════════════════════════════
# Country name → ISO mapping (all 54 AU Member States + common aliases)
# ══════════════════════════════════════════════════════════════════════════════
COUNTRY_MAP_SQL = """
CREATE TEMPORARY TABLE IF NOT EXISTS _country_map (
  tenant_id UUID,
  country_code VARCHAR(3),
  common_name VARCHAR(100),
  geo_entity_id UUID
);

TRUNCATE _country_map;

-- Build from tenants table + hardcoded common names
INSERT INTO _country_map (tenant_id, country_code, common_name)
SELECT t.id, t.country_code,
  CASE t.country_code
    WHEN 'DZ' THEN 'Algeria'
    WHEN 'AO' THEN 'Angola'
    WHEN 'BJ' THEN 'Benin'
    WHEN 'BW' THEN 'Botswana'
    WHEN 'BF' THEN 'Burkina Faso'
    WHEN 'BI' THEN 'Burundi'
    WHEN 'CV' THEN 'Cape Verde'
    WHEN 'CM' THEN 'Cameroon'
    WHEN 'CF' THEN 'Central African Republic'
    WHEN 'TD' THEN 'Chad'
    WHEN 'KM' THEN 'Comoros'
    WHEN 'CG' THEN 'Congo'
    WHEN 'CD' THEN 'DR Congo'
    WHEN 'CI' THEN 'Cote dIvoire'
    WHEN 'DJ' THEN 'Djibouti'
    WHEN 'EG' THEN 'Egypt'
    WHEN 'GQ' THEN 'Equatorial Guinea'
    WHEN 'ER' THEN 'Eritrea'
    WHEN 'SZ' THEN 'Eswatini'
    WHEN 'ET' THEN 'Ethiopia'
    WHEN 'GA' THEN 'Gabon'
    WHEN 'GM' THEN 'Gambia'
    WHEN 'GH' THEN 'Ghana'
    WHEN 'GN' THEN 'Guinea'
    WHEN 'GW' THEN 'Guinea-Bissau'
    WHEN 'KE' THEN 'Kenya'
    WHEN 'LS' THEN 'Lesotho'
    WHEN 'LR' THEN 'Liberia'
    WHEN 'LY' THEN 'Libya'
    WHEN 'MG' THEN 'Madagascar'
    WHEN 'MW' THEN 'Malawi'
    WHEN 'ML' THEN 'Mali'
    WHEN 'MR' THEN 'Mauritania'
    WHEN 'MU' THEN 'Mauritius'
    WHEN 'MA' THEN 'Morocco'
    WHEN 'MZ' THEN 'Mozambique'
    WHEN 'NA' THEN 'Namibia'
    WHEN 'NE' THEN 'Niger'
    WHEN 'NG' THEN 'Nigeria'
    WHEN 'RW' THEN 'Rwanda'
    WHEN 'ST' THEN 'Sao Tome and Principe'
    WHEN 'SN' THEN 'Senegal'
    WHEN 'SC' THEN 'Seychelles'
    WHEN 'SL' THEN 'Sierra Leone'
    WHEN 'SO' THEN 'Somalia'
    WHEN 'ZA' THEN 'South Africa'
    WHEN 'SS' THEN 'South Sudan'
    WHEN 'SD' THEN 'Sudan'
    WHEN 'TZ' THEN 'Tanzania'
    WHEN 'TG' THEN 'Togo'
    WHEN 'TN' THEN 'Tunisia'
    WHEN 'UG' THEN 'Uganda'
    WHEN 'ZM' THEN 'Zambia'
    WHEN 'ZW' THEN 'Zimbabwe'
    ELSE t.name
  END
FROM public.tenants t
WHERE t.level = 'MEMBER_STATE' AND t.country_code IS NOT NULL;

-- Add aliases (alternate spellings found in historical data)
INSERT INTO _country_map (tenant_id, country_code, common_name)
SELECT tenant_id, country_code, alias
FROM (VALUES
  -- French/Portuguese names
  ('CM', 'Cameroun'), ('SN', 'Senegal'), ('SN', 'Sngal'),
  ('TD', 'Tchad'), ('CI', 'Cote d''Ivoire'), ('CI', 'Ivory Coast'),
  ('CD', 'DRC'), ('CD', 'Democratic Republic of the Congo'), ('CD', 'Congo (DRC)'),
  ('CG', 'Republic of Congo'), ('CG', 'Congo (Brazzaville)'),
  ('CF', 'CAR'), ('GQ', 'Eq. Guinea'),
  ('MG', 'Madagasikara'), ('TZ', 'United Republic of Tanzania'),
  ('SZ', 'Swaziland'), ('CV', 'Cabo Verde'),
  ('ST', 'Sao Tome'), ('GW', 'Guinea Bissau'),
  -- Short / ISO codes as names (some historical data uses codes directly)
  ('ZA', 'ZA'), ('NG', 'NG'), ('KE', 'KE'), ('ET', 'ET'), ('GH', 'GH'),
  ('ZW', 'ZW'), ('UG', 'UG'), ('TZ', 'TZ'), ('CM', 'CM'), ('SN', 'SN'),
  ('ML', 'ML'), ('BF', 'BF'), ('NE', 'NE'), ('TD', 'TD'), ('BJ', 'BJ'),
  ('TG', 'TG'), ('CI', 'CI'), ('GN', 'GN'), ('SL', 'SL'), ('LR', 'LR'),
  ('GM', 'GM'), ('MR', 'MR'), ('SD', 'SD'), ('SS', 'SS'), ('ER', 'ER'),
  ('DJ', 'DJ'), ('SO', 'SO'), ('RW', 'RW'), ('BI', 'BI'), ('CD', 'CD'),
  ('CG', 'CG'), ('GA', 'GA'), ('CF', 'CF'), ('GQ', 'GQ'), ('ST', 'ST'),
  ('AO', 'AO'), ('MZ', 'MZ'), ('ZM', 'ZM'), ('MW', 'MW'), ('LS', 'LS'),
  ('BW', 'BW'), ('NA', 'NA'), ('SZ', 'SZ'), ('MG', 'MG'), ('KM', 'KM'),
  ('MU', 'MU'), ('SC', 'SC'), ('EG', 'EG'), ('LY', 'LY'), ('TN', 'TN'),
  ('DZ', 'DZ'), ('MA', 'MA'), ('CV', 'CV'), ('GW', 'GW')
) AS aliases(cc, alias)
JOIN _country_map cm ON cm.country_code = aliases.cc
WHERE NOT EXISTS (
  SELECT 1 FROM _country_map x WHERE x.common_name = aliases.alias
)
ON CONFLICT DO NOTHING;

-- Populate geo_entity_id from master_data.geo_entities (country-level)
UPDATE _country_map cm
SET geo_entity_id = ge.id
FROM master_data.geo_entities ge
WHERE ge.iso_code = cm.country_code
  AND ge.level = 'country';

-- Fallback: if no geo_entities match, try by admin_level = 0
UPDATE _country_map cm
SET geo_entity_id = ge.id
FROM master_data.geo_entities ge
WHERE cm.geo_entity_id IS NULL
  AND ge.iso_code = cm.country_code
  AND ge.admin_level = 0;
"""


# ══════════════════════════════════════════════════════════════════════════════
# Step 1: Pre-flight checks
# ══════════════════════════════════════════════════════════════════════════════
def step_1_preflight(dry_run):
    step("Step 1 — Pre-flight checks")

    # Check source tables exist and have data
    sql = f"""
SELECT 'health' AS src, COUNT(*) FROM {TBL_HEALTH}
UNION ALL
SELECT 'vaccination', COUNT(*) FROM {TBL_VACC}
UNION ALL
SELECT 'census', COUNT(*) FROM {TBL_CENSUS};
"""
    out = run_sql("Source table row counts", sql)

    # Check target tables current state
    sql2 = """
SELECT 'health_events' AS tgt, COUNT(*) FROM animal_health.health_events
UNION ALL
SELECT 'vaccination_campaigns', COUNT(*) FROM animal_health.vaccination_campaigns
UNION ALL
SELECT 'livestock_census', COUNT(*) FROM livestock_prod.livestock_census;
"""
    run_sql("Target table row counts (before import)", sql2)

    # Check tenant mapping
    sql3 = f"""
{COUNTRY_MAP_SQL}

SELECT COUNT(*) AS mapped_tenants FROM _country_map;
"""
    run_sql("Country mapping table", sql3)

    # Show unmapped admin_location values
    sql4 = f"""
{COUNTRY_MAP_SQL}

SELECT DISTINCT SPLIT_PART(h.admin_location, ' / ', 1) AS loc, COUNT(*) AS rows
FROM {TBL_HEALTH} h
LEFT JOIN _country_map cm
  ON SPLIT_PART(h.admin_location, ' / ', 1) = cm.common_name
  OR SPLIT_PART(h.admin_location, ' / ', 1) = cm.country_code
WHERE cm.tenant_id IS NULL
GROUP BY 1
ORDER BY 2 DESC
LIMIT 30;
"""
    run_sql("UNMAPPED locations in health data (top 30)", sql4)

    # Disease distribution
    sql5 = f"""
SELECT
  CASE WHEN disease ~ '^[0-9a-f]{{8}}-' THEN 'UUID' ELSE 'NAME' END AS disease_format,
  CASE WHEN disease = 'ZERO-CAS' THEN 'ZERO-CAS'
       WHEN outbreak_in_month = 'no' THEN 'NO-OUTBREAK'
       ELSE 'OUTBREAK' END AS category,
  COUNT(*)
FROM {TBL_HEALTH}
GROUP BY 1, 2
ORDER BY 3 DESC;
"""
    run_sql("Disease format + category distribution", sql5)


# ══════════════════════════════════════════════════════════════════════════════
# Step 2: Import health events (outbreaks with UUID diseases)
# ══════════════════════════════════════════════════════════════════════════════
def step_2_health_events(dry_run):
    step("Step 2 — Import health events (outbreaks)")

    count_sql = f"""
{COUNTRY_MAP_SQL}

SELECT COUNT(*) AS rows_to_import
FROM {TBL_HEALTH} h
JOIN _country_map cm ON (
  SPLIT_PART(h.admin_location, ' / ', 1) = cm.common_name
  OR SPLIT_PART(h.admin_location, ' / ', 1) = cm.country_code
)
WHERE h.disease != 'ZERO-CAS'
  AND h.outbreak_in_month != 'no'
  AND h.disease ~ '^[0-9a-f]{{8}}-';
"""
    run_sql("Count: outbreak rows with UUID diseases", count_sql)

    if dry_run:
        print("  [DRY RUN] Skipping INSERT")
        return

    insert_sql = f"""
{COUNTRY_MAP_SQL}

INSERT INTO animal_health.health_events (
  id, tenant_id, disease_id, event_type, species_ids,
  date_suspicion, geo_entity_id,
  holdings_affected, susceptible, cases, deaths, killed, slaughtered,
  control_measures, confidence_level, data_classification,
  wahis_ready, created_by, updated_by, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  cm.tenant_id,
  h.disease::uuid,
  'CONFIRMED',
  COALESCE(
    ARRAY(
      SELECT (elem->>'species')::uuid
      FROM jsonb_array_elements(
        CASE WHEN h.animals_affected IS NOT NULL AND h.animals_affected::text ~ '^\\['
             THEN h.animals_affected::jsonb
             ELSE '[]'::jsonb END
      ) elem
      WHERE elem->>'species' IS NOT NULL
        AND elem->>'species' ~ '^[0-9a-f]{{8}}-'
    ),
    ARRAY[]::uuid[]
  ),
  h.date_of_report,
  COALESCE(cm.geo_entity_id, '{PLACEHOLDER_GEO}'::uuid),
  COALESCE(h.num_new_outbreaks::int, 1),
  COALESCE((
    SELECT SUM(NULLIF(elem->>'num_susceptible','')::numeric)::int
    FROM jsonb_array_elements(
      CASE WHEN h.animals_affected IS NOT NULL AND h.animals_affected::text ~ '^\\['
           THEN h.animals_affected::jsonb
           ELSE '[]'::jsonb END
    ) elem
    WHERE elem->>'num_susceptible' IS NOT NULL AND elem->>'num_susceptible' ~ '^[0-9]'
  ), 0),
  COALESCE((
    SELECT SUM(NULLIF(elem->>'num_cases','')::numeric)::int
    FROM jsonb_array_elements(
      CASE WHEN h.animals_affected IS NOT NULL AND h.animals_affected::text ~ '^\\['
           THEN h.animals_affected::jsonb
           ELSE '[]'::jsonb END
    ) elem
    WHERE elem->>'num_cases' IS NOT NULL AND elem->>'num_cases' ~ '^[0-9]'
  ), 0),
  COALESCE((
    SELECT SUM(NULLIF(elem->>'num_deaths','')::numeric)::int
    FROM jsonb_array_elements(
      CASE WHEN h.animals_affected IS NOT NULL AND h.animals_affected::text ~ '^\\['
           THEN h.animals_affected::jsonb
           ELSE '[]'::jsonb END
    ) elem
    WHERE elem->>'num_deaths' IS NOT NULL AND elem->>'num_deaths' ~ '^[0-9]'
  ), 0),
  0,  -- killed (not in historical data)
  COALESCE((
    SELECT SUM(NULLIF(elem->>'num_slaughtered','')::numeric)::int
    FROM jsonb_array_elements(
      CASE WHEN h.animals_affected IS NOT NULL AND h.animals_affected::text ~ '^\\['
           THEN h.animals_affected::jsonb
           ELSE '[]'::jsonb END
    ) elem
    WHERE elem->>'num_slaughtered' IS NOT NULL AND elem->>'num_slaughtered' ~ '^[0-9]'
  ), 0),
  COALESCE(
    ARRAY(
      SELECT elem->>'measure'
      FROM jsonb_array_elements(
        CASE WHEN h.control_measures IS NOT NULL AND h.control_measures::text ~ '^\\['
             THEN h.control_measures::jsonb
             ELSE '[]'::jsonb END
      ) elem
      WHERE elem->>'measure' IS NOT NULL AND elem->>'measure' != ''
    ),
    ARRAY[]::text[]
  ),
  'CONFIRMED',
  'RESTRICTED',
  true,
  '{SYSTEM_USER_ID}'::uuid,
  '{SYSTEM_USER_ID}'::uuid,
  COALESCE(h.date_of_report, NOW()),
  NOW()
FROM {TBL_HEALTH} h
JOIN _country_map cm ON (
  SPLIT_PART(h.admin_location, ' / ', 1) = cm.common_name
  OR SPLIT_PART(h.admin_location, ' / ', 1) = cm.country_code
)
WHERE h.disease != 'ZERO-CAS'
  AND h.outbreak_in_month != 'no'
  AND h.disease ~ '^[0-9a-f]{{8}}-';
"""
    run_sql("INSERT outbreak health events", insert_sql, timeout=900)


# ══════════════════════════════════════════════════════════════════════════════
# Step 3: Import ZERO declarations
# ══════════════════════════════════════════════════════════════════════════════
def step_3_zero_reports(dry_run):
    step("Step 3 — Import ZERO declarations")

    # Use a well-known disease placeholder for zero reports
    # First check if one exists; if not, we create one
    zero_disease_sql = """
SELECT id FROM animal_health.ref_diseases
WHERE code = 'ZERO-REPORT' OR code = 'NO-DISEASE'
LIMIT 1;
"""
    out = run_sql("Check for zero-report disease ref", zero_disease_sql)

    # We'll use a deterministic UUID for the zero-report placeholder
    ZERO_DISEASE_ID = "00000000-0000-4000-b000-000000000000"

    ensure_zero_disease = f"""
INSERT INTO animal_health.ref_diseases (id, code, name, description, is_notifiable, is_zoonotic, scope, is_active, is_default, sort_order, created_at, updated_at)
VALUES (
  '{ZERO_DISEASE_ID}'::uuid,
  'ZERO-REPORT',
  '{{"en": "Zero Report (No Disease)", "fr": "Rapport zero (Aucune maladie)"}}'::jsonb,
  '{{"en": "Placeholder for zero-reporting declarations", "fr": "Placeholder pour declarations zero"}}'::jsonb,
  false, false, 'continental', true, false, 9999,
  NOW(), NOW()
)
ON CONFLICT DO NOTHING;
"""
    if not dry_run:
        run_sql("Ensure ZERO-REPORT disease reference exists", ensure_zero_disease)

    count_sql = f"""
{COUNTRY_MAP_SQL}

SELECT COUNT(*) AS zero_rows
FROM {TBL_HEALTH} h
JOIN _country_map cm ON (
  SPLIT_PART(h.admin_location, ' / ', 1) = cm.common_name
  OR SPLIT_PART(h.admin_location, ' / ', 1) = cm.country_code
)
WHERE h.disease = 'ZERO-CAS'
   OR (h.outbreak_in_month = 'no' AND (h.disease IS NULL OR h.disease = 'ZERO-CAS'));
"""
    run_sql("Count: zero declaration rows", count_sql)

    if dry_run:
        print("  [DRY RUN] Skipping INSERT")
        return

    insert_sql = f"""
{COUNTRY_MAP_SQL}

INSERT INTO animal_health.health_events (
  id, tenant_id, disease_id, event_type, species_ids,
  date_suspicion, geo_entity_id,
  holdings_affected, susceptible, cases, deaths, killed, slaughtered,
  control_measures, confidence_level, data_classification,
  wahis_ready, created_by, updated_by, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  cm.tenant_id,
  '{ZERO_DISEASE_ID}'::uuid,
  'ZERO_REPORT',
  ARRAY[]::uuid[],
  h.date_of_report,
  COALESCE(cm.geo_entity_id, '{PLACEHOLDER_GEO}'::uuid),
  0, 0, 0, 0, 0, 0,
  ARRAY[]::text[],
  'CONFIRMED',
  'PUBLIC',
  true,
  '{SYSTEM_USER_ID}'::uuid,
  '{SYSTEM_USER_ID}'::uuid,
  COALESCE(h.date_of_report, NOW()),
  NOW()
FROM {TBL_HEALTH} h
JOIN _country_map cm ON (
  SPLIT_PART(h.admin_location, ' / ', 1) = cm.common_name
  OR SPLIT_PART(h.admin_location, ' / ', 1) = cm.country_code
)
WHERE h.disease = 'ZERO-CAS'
   OR (h.outbreak_in_month = 'no' AND (h.disease IS NULL OR h.disease = 'ZERO-CAS'));
"""
    run_sql("INSERT zero declaration health events", insert_sql, timeout=600)


# ══════════════════════════════════════════════════════════════════════════════
# Step 4: Import vaccination campaigns
# ══════════════════════════════════════════════════════════════════════════════
def step_4_vaccination(dry_run):
    step("Step 4 — Import vaccination campaigns")

    count_sql = f"""
{COUNTRY_MAP_SQL}

SELECT COUNT(*) AS vacc_rows
FROM {TBL_VACC} v
JOIN _country_map cm ON (
  SPLIT_PART(v.admin_location, ' / ', 1) = cm.common_name
  OR SPLIT_PART(v.admin_location, ' / ', 1) = cm.country_code
)
WHERE v.num_animals_vaccinated IS NOT NULL
  AND v.num_animals_vaccinated::text ~ '^[0-9]';
"""
    run_sql("Count: vaccination rows to import", count_sql)

    if dry_run:
        print("  [DRY RUN] Skipping INSERT")
        return

    insert_sql = f"""
{COUNTRY_MAP_SQL}

INSERT INTO animal_health.vaccination_campaigns (
  id, tenant_id, disease_id, species_id,
  vaccine_type, doses_delivered, doses_used,
  target_population, coverage_estimate,
  period_start, period_end, geo_entity_id,
  data_classification, created_by, updated_by, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  cm.tenant_id,
  v.disease::uuid,
  v.species::uuid,
  COALESCE(v.vaccine_name, COALESCE(v.vaccine_type, 'Unknown')),
  COALESCE(v.num_animals_vaccinated::int, 0),
  COALESCE(v.num_animals_vaccinated::int, 0),
  0,  -- target_population unknown from historical
  0,  -- coverage_estimate unknown
  make_timestamptz(
    v.year_of_report::int,
    GREATEST(COALESCE(
      CASE WHEN v.month ~ '^[0-9]+$' THEN v.month::int ELSE NULL END,
      1
    ), 1),
    1, 0, 0, 0, 'UTC'
  ),
  make_timestamptz(
    v.year_of_report::int,
    LEAST(GREATEST(COALESCE(
      CASE WHEN v.month ~ '^[0-9]+$' THEN v.month::int ELSE NULL END,
      1
    ), 1), 12),
    28, 23, 59, 59, 'UTC'
  ),
  COALESCE(cm.geo_entity_id, '{PLACEHOLDER_GEO}'::uuid),
  'RESTRICTED',
  '{SYSTEM_USER_ID}'::uuid,
  '{SYSTEM_USER_ID}'::uuid,
  NOW(), NOW()
FROM {TBL_VACC} v
JOIN _country_map cm ON (
  SPLIT_PART(v.admin_location, ' / ', 1) = cm.common_name
  OR SPLIT_PART(v.admin_location, ' / ', 1) = cm.country_code
)
WHERE v.num_animals_vaccinated IS NOT NULL
  AND v.num_animals_vaccinated::text ~ '^[0-9]'
  AND v.year_of_report IS NOT NULL
  AND v.year_of_report::text ~ '^[0-9]{{4}}'
  AND v.disease IS NOT NULL AND v.disease ~ '^[0-9a-f]{{8}}-'
  AND v.species IS NOT NULL AND v.species ~ '^[0-9a-f]{{8}}-';
"""
    run_sql("INSERT vaccination campaigns", insert_sql, timeout=120)

    # Report skipped rows (non-UUID disease or species)
    skip_sql = f"""
{COUNTRY_MAP_SQL}

SELECT COUNT(*) AS skipped_no_uuid
FROM {TBL_VACC} v
JOIN _country_map cm ON (
  SPLIT_PART(v.admin_location, ' / ', 1) = cm.common_name
  OR SPLIT_PART(v.admin_location, ' / ', 1) = cm.country_code
)
WHERE v.num_animals_vaccinated IS NOT NULL
  AND v.num_animals_vaccinated::text ~ '^[0-9]'
  AND (v.disease IS NULL OR v.disease !~ '^[0-9a-f]{{8}}-'
       OR v.species IS NULL OR v.species !~ '^[0-9a-f]{{8}}-');
"""
    run_sql("Skipped vaccination rows (non-UUID disease/species)", skip_sql)


# ══════════════════════════════════════════════════════════════════════════════
# Step 5: Import livestock census
# ══════════════════════════════════════════════════════════════════════════════
def step_5_livestock_census(dry_run):
    step("Step 5 — Import livestock census")

    count_sql = f"""
{COUNTRY_MAP_SQL}

SELECT COUNT(*) AS census_rows
FROM {TBL_CENSUS} l
JOIN _country_map cm ON (
  SPLIT_PART(l.admin_location, ' / ', 1) = cm.common_name
  OR SPLIT_PART(l.admin_location, ' / ', 1) = cm.country_code
)
WHERE l.num_animals IS NOT NULL
  AND l.num_animals::text ~ '^[0-9]';
"""
    run_sql("Count: livestock census rows to import", count_sql)

    if dry_run:
        print("  [DRY RUN] Skipping INSERT")
        return

    insert_sql = f"""
{COUNTRY_MAP_SQL}

INSERT INTO livestock_prod.livestock_census (
  id, tenant_id, geo_entity_id, species_id,
  year, population, methodology, source,
  data_classification, created_by, updated_by, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  cm.tenant_id,
  COALESCE(cm.geo_entity_id, '{PLACEHOLDER_GEO}'::uuid),
  l.species::uuid,
  l.year_of_report::int,
  COALESCE(l.num_animals::bigint, 0)::int,
  COALESCE(l.methodology, 'ENUMERATION'),
  'ARIS 3 Historical Import',
  'PARTNER',
  '{SYSTEM_USER_ID}'::uuid,
  '{SYSTEM_USER_ID}'::uuid,
  NOW(), NOW()
FROM {TBL_CENSUS} l
JOIN _country_map cm ON (
  SPLIT_PART(l.admin_location, ' / ', 1) = cm.common_name
  OR SPLIT_PART(l.admin_location, ' / ', 1) = cm.country_code
)
WHERE l.num_animals IS NOT NULL
  AND l.num_animals::text ~ '^[0-9]'
  AND l.year_of_report IS NOT NULL
  AND l.year_of_report::text ~ '^[0-9]{{4}}'
  AND l.species IS NOT NULL AND l.species ~ '^[0-9a-f]{{8}}-';
"""
    run_sql("INSERT livestock census", insert_sql, timeout=60)


# ══════════════════════════════════════════════════════════════════════════════
# Step 6: Post-import verification
# ══════════════════════════════════════════════════════════════════════════════
def step_6_verify():
    step("Step 6 — Post-import verification")

    sql = """
SELECT 'health_events' AS tbl, COUNT(*) AS total,
       COUNT(*) FILTER (WHERE event_type = 'CONFIRMED') AS outbreaks,
       COUNT(*) FILTER (WHERE event_type = 'ZERO_REPORT') AS zero_reports
FROM animal_health.health_events

UNION ALL

SELECT 'vaccination_campaigns', COUNT(*), NULL, NULL
FROM animal_health.vaccination_campaigns

UNION ALL

SELECT 'livestock_census', COUNT(*), NULL, NULL
FROM livestock_prod.livestock_census;
"""
    run_sql("Final row counts (after import)", sql)

    # Breakdown by country for health events
    sql2 = """
SELECT t.country_code, t.name AS country,
       COUNT(*) AS events,
       COUNT(*) FILTER (WHERE he.event_type = 'CONFIRMED') AS outbreaks,
       COUNT(*) FILTER (WHERE he.event_type = 'ZERO_REPORT') AS zero_reports
FROM animal_health.health_events he
JOIN public.tenants t ON t.id = he.tenant_id
GROUP BY t.country_code, t.name
ORDER BY events DESC
LIMIT 20;
"""
    run_sql("Top 20 countries by health events", sql2)


# ══════════════════════════════════════════════════════════════════════════════
# Step 7: Recalculate indicator values
# ══════════════════════════════════════════════════════════════════════════════
def step_7_indicators():
    step("Step 7 — Recalculate indicator values")
    print("  Connecting to VM-APP to run indicator seed...")

    db_url = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:5432/{DB_NAME}"
    cmd = (
        f"cd /opt/aris && "
        f"DATABASE_URL='{db_url}' "
        f"npx tsx packages/db-schemas/prisma/seed-indicator-values.ts 2>&1 | tail -20"
    )
    code, out, err = ssh(VM_APP, cmd, timeout=300)
    clean = "\n".join(
        l for l in out.splitlines()
        if "[sudo]" not in l and "password for" not in l
    )
    if clean.strip():
        for line in clean.strip().splitlines():
            print(f"     {line}")
    if code != 0:
        print(f"  !! Indicator seed exited with code {code}")
        if err:
            print(f"  !! {err[:300]}")
    else:
        print("  -- Indicator values recalculated successfully")


# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(
        description="Import historical data into ARIS transactional tables"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Only show counts, do not insert any data"
    )
    parser.add_argument(
        "--step", type=int, default=0,
        help="Run only a specific step (1-7). 0 = all steps."
    )
    parser.add_argument(
        "--skip-indicators", action="store_true",
        help="Skip indicator recalculation (step 7)"
    )
    args = parser.parse_args()

    print("=" * 70)
    print("  ARIS 4.0 — Historical → Transactional Import")
    print(f"  Mode: {'DRY RUN (no writes)' if args.dry_run else 'LIVE IMPORT'}")
    if args.step:
        print(f"  Running: step {args.step} only")
    print("=" * 70)

    t_start = time.time()

    steps = {
        1: ("Pre-flight checks", lambda: step_1_preflight(args.dry_run)),
        2: ("Health events (outbreaks)", lambda: step_2_health_events(args.dry_run)),
        3: ("Zero declarations", lambda: step_3_zero_reports(args.dry_run)),
        4: ("Vaccination campaigns", lambda: step_4_vaccination(args.dry_run)),
        5: ("Livestock census", lambda: step_5_livestock_census(args.dry_run)),
        6: ("Post-import verification", step_6_verify),
        7: ("Indicator recalculation", step_7_indicators),
    }

    if args.step:
        if args.step not in steps:
            print(f"ERROR: Invalid step {args.step}. Valid: 1-7")
            sys.exit(1)
        name, fn = steps[args.step]
        try:
            fn()
        except Exception as e:
            print(f"\n  !! Step {args.step} ({name}) FAILED: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
    else:
        for i in sorted(steps.keys()):
            if i == 7 and (args.skip_indicators or args.dry_run):
                print(f"\n  [SKIP] Step 7 — Indicator recalculation")
                continue
            name, fn = steps[i]
            try:
                fn()
            except Exception as e:
                print(f"\n  !! Step {i} ({name}) FAILED: {e}")
                import traceback
                traceback.print_exc()
                # Continue to next step
                continue

    elapsed = time.time() - t_start
    print(f"\n{'='*70}")
    print(f"  DONE — Total time: {elapsed:.0f}s ({elapsed/60:.1f} min)")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
