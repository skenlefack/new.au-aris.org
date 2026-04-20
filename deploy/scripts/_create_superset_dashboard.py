#!/usr/bin/env python3
"""
Create Superset Historical dashboards via direct metadata DB insertion.
"""
import json
import sys
import time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = {
    "stg": {
        "host": "10.202.101.148",
        "pg_container": "aris-stg-postgres",
        "meta_db": "superset_meta",
        "aris_db": "aris",
    },
    "prod": {
        "host": "10.202.101.185",
        "pg_container": "aris-postgres",
        "meta_db": "superset_meta",
        "aris_db": "aris",
    },
}


def run_sql(ssh, container, db, sql):
    escaped = sql.replace("'", "'\\''")
    cmd = f"docker exec {container} psql -U aris -d {db} -t -c '{escaped}'"
    _, out, err = ssh.exec_command(cmd, timeout=15)
    result = out.read().decode().strip()
    error = err.read().decode().strip()
    if error and "NOTICE" not in error and "already exists" not in error:
        print(f"  [SQL err] {error[:200]}")
    return result


def setup(env_name):
    cfg = ENVS[env_name]
    print(f"\n{'='*60}")
    print(f"  SUPERSET DASHBOARDS — {env_name.upper()}")
    print(f"{'='*60}\n")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(cfg["host"], username=SSH_USER, password=SSH_PASS,
                timeout=30, allow_agent=False, look_for_keys=False)

    pg = cfg["pg_container"]
    meta = cfg["meta_db"]
    aris = cfg["aris_db"]

    # 1. Find the database ID in Superset
    db_id = run_sql(ssh, pg, meta, "SELECT id FROM dbs WHERE database_name='ARIS' LIMIT 1")
    if not db_id:
        print("  [ERROR] No 'ARIS' database found in Superset. Create it manually first.")
        ssh.close()
        return
    db_id = int(db_id)
    print(f"[1] Superset DB 'ARIS' id={db_id}")

    # 2. Get historical table names
    tables = run_sql(ssh, pg, aris,
        "SELECT tablename FROM pg_tables WHERE schemaname='historical' ORDER BY tablename"
    ).split("\n")
    tables = [t.strip() for t in tables if t.strip()]
    print(f"[2] Historical tables: {len(tables)}")

    # 3. Create the UNION ALL view in the aris database
    print("[3] Creating SQL view for Superset...")

    # Get common columns from first table
    if not tables:
        print("  [ERROR] No historical tables found")
        ssh.close()
        return

    # Build UNION ALL of all monthly health tables
    health_tables = [t for t in tables if "monthly_animal" in t or "monthly_health" in t]
    if not health_tables:
        health_tables = tables[:1]  # fallback

    union_parts = [
        f'SELECT admin_location, date_of_report, disease, num_new_outbreaks, '
        f'outbreak_status, source_infection, reporting_period '
        f'FROM historical."{t}"'
        for t in health_tables
    ]
    union_sql = " UNION ALL ".join(union_parts)

    # Create materialized view
    view_sql = f"""
DROP MATERIALIZED VIEW IF EXISTS historical.v_disease_reports CASCADE;
CREATE MATERIALIZED VIEW historical.v_disease_reports AS
SELECT
  admin_location,
  date_of_report,
  disease,
  num_new_outbreaks,
  outbreak_status,
  source_infection,
  reporting_period,
  CASE WHEN date_of_report ~ '^[12]' THEN EXTRACT(YEAR FROM date_of_report::timestamp)::int ELSE NULL END as report_year
FROM ({union_sql}) unified
WHERE disease IS NOT NULL AND disease != ''
  AND date_of_report IS NOT NULL AND date_of_report != ''
  AND date_of_report ~ '^[12]';
CREATE INDEX IF NOT EXISTS idx_vdr_year ON historical.v_disease_reports (report_year);
CREATE INDEX IF NOT EXISTS idx_vdr_disease ON historical.v_disease_reports (disease);
CREATE INDEX IF NOT EXISTS idx_vdr_location ON historical.v_disease_reports (admin_location);
"""
    print("  Creating materialized view v_disease_reports...")
    result = run_sql(ssh, pg, aris, view_sql)
    print(f"  {result or 'OK'}")

    # Count rows
    count = run_sql(ssh, pg, aris, "SELECT count(*) FROM historical.v_disease_reports")
    print(f"  View has {count} rows")

    # 4. Create a summary table
    summary_sql = """
DROP MATERIALIZED VIEW IF EXISTS historical.v_disease_summary CASCADE;
CREATE MATERIALIZED VIEW historical.v_disease_summary AS
SELECT
  disease,
  admin_location,
  report_year as year,
  COUNT(*)::int as report_count,
  SUM(CASE WHEN num_new_outbreaks ~ '^[0-9.]+$' THEN num_new_outbreaks::numeric ELSE 0 END)::int as total_outbreaks
FROM historical.v_disease_reports
WHERE report_year IS NOT NULL
GROUP BY disease, admin_location, report_year
ORDER BY report_year, report_count DESC;
CREATE INDEX IF NOT EXISTS idx_vds_year ON historical.v_disease_summary (year);
CREATE INDEX IF NOT EXISTS idx_vds_disease ON historical.v_disease_summary (disease);
"""
    print("  Creating materialized view v_disease_summary...")
    result = run_sql(ssh, pg, aris, summary_sql)
    count2 = run_sql(ssh, pg, aris, "SELECT count(*) FROM historical.v_disease_summary")
    print(f"  Summary has {count2} rows")

    # 5. Register these views as Superset datasets
    print("\n[4] Registering datasets in Superset...")

    for view_name, description in [
        ("v_disease_reports", "All disease reports from historical data (2008-2025)"),
        ("v_disease_summary", "Disease reports aggregated by disease, country, year"),
    ]:
        # Check if already exists
        existing = run_sql(ssh, pg, meta,
            f"SELECT id FROM tables WHERE table_name='{view_name}' AND database_id={db_id}")
        if existing:
            print(f"  {view_name}: already exists (id={existing})")
            continue

        insert_sql = f"""
INSERT INTO tables (table_name, schema, database_id, is_sqllab_view, description, created_on, changed_on)
VALUES ('{view_name}', 'historical', {db_id}, false, '{description}', NOW(), NOW())
RETURNING id
"""
        ds_id = run_sql(ssh, pg, meta, insert_sql)
        print(f"  {view_name}: created (id={ds_id})")

    # 6. Create the dashboard
    print("\n[5] Creating dashboard...")

    existing_dash = run_sql(ssh, pg, meta,
        "SELECT id FROM dashboards WHERE dashboard_title='ARIS Historical — Continental Overview'")
    if existing_dash:
        print(f"  Dashboard already exists (id={existing_dash})")
    else:
        dash_json = json.dumps({
            "timed_refresh_immune_slices": [],
            "expanded_slices": {},
            "refresh_frequency": 0,
            "color_scheme": "supersetColors",
            "label_colors": {},
            "shared_label_colors": {},
        }).replace("'", "''")

        dash_sql = f"""
INSERT INTO dashboards (dashboard_title, published, json_metadata, created_on, changed_on, slug)
VALUES (
  'ARIS Historical — Continental Overview',
  true,
  '{dash_json}',
  NOW(), NOW(),
  'aris-historical-overview'
)
RETURNING id
"""
        dash_id = run_sql(ssh, pg, meta, dash_sql)
        print(f"  Dashboard created (id={dash_id})")

    # 7. Create saved queries in SQL Lab
    print("\n[6] Creating saved SQL queries...")

    queries = [
        ("Epidemic Curve — Disease Reports by Year",
         "SELECT report_year as year, COUNT(*) as reports FROM historical.v_disease_reports GROUP BY report_year ORDER BY year"),
        ("Top 20 Diseases — All Time",
         "SELECT disease, COUNT(*) as reports, SUM(CASE WHEN num_new_outbreaks ~ '^[0-9]+$' THEN num_new_outbreaks::int ELSE 0 END) as outbreaks FROM historical.v_disease_reports GROUP BY disease ORDER BY reports DESC LIMIT 20"),
        ("Reports by Country",
         "SELECT admin_location, COUNT(*) as reports FROM historical.v_disease_reports GROUP BY admin_location ORDER BY reports DESC LIMIT 30"),
        ("Disease x Country Matrix",
         "SELECT disease, admin_location, COUNT(*) as reports FROM historical.v_disease_summary GROUP BY disease, admin_location ORDER BY reports DESC LIMIT 500"),
        ("Yearly Trend by Disease",
         "SELECT year, disease, SUM(report_count) as reports FROM historical.v_disease_summary WHERE year >= 2010 GROUP BY year, disease ORDER BY year, reports DESC"),
    ]

    for label, sql in queries:
        existing = run_sql(ssh, pg, meta,
            f"SELECT id FROM saved_query WHERE label='{label.replace(chr(39), chr(39)+chr(39))}'")
        if existing:
            print(f"  {label}: exists (id={existing})")
            continue

        escaped_sql = sql.replace("'", "''")
        insert = f"""
INSERT INTO saved_query (label, db_id, sql, schema, created_on, changed_on, created_by_fk, changed_by_fk)
VALUES ('{label.replace("'", "''")}', {db_id}, '{escaped_sql}', 'historical', NOW(), NOW(), 1, 1)
RETURNING id
"""
        qid = run_sql(ssh, pg, meta, insert)
        print(f"  {label}: created (id={qid})")

    ssh.close()

    print(f"\n{'='*60}")
    print(f"  DONE — {env_name.upper()}")
    print(f"{'='*60}")
    host_prefix = "superset-test" if env_name == "stg" else "superset"
    print(f"\nAccess Superset: https://{host_prefix}.au-aris.org")
    print(f"  - Dashboard: SQL Lab > Saved Queries > 'ARIS Historical'")
    print(f"  - Datasets: 'v_disease_reports' + 'v_disease_summary' in SQL Lab")
    print(f"  - Views: historical.v_disease_reports ({count} rows)")
    print(f"           historical.v_disease_summary ({count2} rows)")


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", default="stg", choices=["stg", "prod"])
    args = ap.parse_args()
    setup(args.env)
