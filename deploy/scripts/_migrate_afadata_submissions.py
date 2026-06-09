#!/usr/bin/env python3
"""
ARIS 4.0 — AfaData Migration via Submissions
=============================================
Migrates AfaData data into ARIS using the existing Submissions system
(same approach as PPR surveys). NO new backend code required.

This script:
1. Creates 6 campaigns in ARIS (one per AfaData data type)
2. Links each campaign to the corresponding fisheries form template
3. Imports data as submissions (JSON in data column)

Prerequisites:
- Access to AfaData MariaDB (or CSV exports in /tmp/afadata_export/)
- ARIS running on target environment

Usage:
  # Step 1: Create campaigns + link templates
  python -u _migrate_afadata_submissions.py --step=setup --env=PROD

  # Step 2: Import from CSV files (place CSVs in C:/new.au-aris.org/afadata-export/)
  python -u _migrate_afadata_submissions.py --step=import --env=PROD

  # Step 3: Verify counts
  python -u _migrate_afadata_submissions.py --step=verify --env=PROD

  # All steps
  python -u _migrate_afadata_submissions.py --step=all --env=PROD
"""
import paramiko
import json
import sys
import os
import uuid
import hashlib
import csv
import io
import tempfile
import argparse

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
TENANT_AU_IBAR = "00000000-0000-4000-a000-000000000001"
USER_SUPER_ADMIN = "10000000-0000-4000-a000-000000000001"

ENV_CONFIG = {
    "PROD": {"host": "10.202.101.183", "db_host": "10.202.101.185", "db_pass": "Ar1s_Pr0d_2024!xK9mZ"},
    "STG":  {"host": "10.202.101.146", "db_host": "10.202.101.148", "db_pass": "Ar1s_Stg_2024!xK9mZ"},
}

# Local directory for CSV exports from AfaData
LOCAL_CSV_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "afadata-export")

# ── Campaign definitions ──
# Each maps to an existing fisheries form template
CAMPAIGNS = [
    {
        "key": "captures",
        "name": {"en": "AFADATA — Capture Fisheries (2007-2025)", "fr": "AFADATA — Pêche de Capture (2007-2025)"},
        "template_name": "Capture Fisheries Report",
        "domain": "fisheries",
        "csv_file": "captures.csv",
        "field_map": {
            # CSV column -> form field name
            "species_fao_code": "species",
            "fao_area_code": "fao_area_code",
            "gear_type": "gear_type",
            "quantity_kg": "quantity_kg",
            "capture_date": "capture_date",
            "landing_site": "landing_site",
            "fishing_environment": "fishing_environment",
            "production_type": "production_type",
            "latitude": "gps_lat",
            "longitude": "gps_lng",
            "notes": "remarks",
            "country": "_country",
        },
    },
    {
        "key": "vessels",
        "name": {"en": "AFADATA — Fishing Vessels Registry", "fr": "AFADATA — Registre des Navires de Pêche"},
        "template_name": "Fishing Vessel Registration",
        "domain": "fisheries",
        "csv_file": "vessels.csv",
        "field_map": {
            "name": "vessel_name",
            "registration_number": "registration_number",
            "country": "_country",
            "vessel_type": "vessel_type",
            "length_meters": "length_meters",
            "tonnage_gt": "tonnage_gt",
            "engine_power_kw": "engine_power_kw",
            "crew_capacity": "crew_capacity",
            "owner_name": "owner_name",
            "home_port": "home_port",
            "license_number": "license_number",
            "license_expiry": "license_expiry",
            "is_active": "is_active",
        },
    },
    {
        "key": "farms",
        "name": {"en": "AFADATA — Aquaculture Farms", "fr": "AFADATA — Fermes Aquacoles"},
        "template_name": "Aquaculture Farm Registration",
        "domain": "fisheries",
        "csv_file": "farms.csv",
        "field_map": {
            "name": "farm_name",
            "farm_type": "farm_type",
            "water_source": "water_source",
            "area_hectares": "area_hectares",
            "owner_name": "owner_name",
            "registration_number": "registration_number",
            "total_workers": "total_workers",
            "male_workers": "male_workers",
            "female_workers": "female_workers",
            "pond_count": "pond_count",
            "is_active": "is_active",
            "country": "_country",
            "latitude": "gps_lat",
            "longitude": "gps_lng",
        },
    },
    {
        "key": "aquaculture",
        "name": {"en": "AFADATA — Aquaculture Production (2007-2025)", "fr": "AFADATA — Production Aquacole (2007-2025)"},
        "template_name": "Aquaculture Production Report",
        "domain": "fisheries",
        "csv_file": "aquaculture_production.csv",
        "field_map": {
            "species_fao_code": "species",
            "farm_id": "farm_name",
            "quantity_kg": "quantity_kg",
            "production_date": "harvest_date",
            "harvest_method": "method_of_culture",
            "stocking_date": "stocking_date",
            "survival_rate": "survival_rate",
            "average_weight_grams": "avg_harvest_weight_g",
            "country": "_country",
            "notes": "remarks",
        },
    },
    {
        "key": "efforts",
        "name": {"en": "AFADATA — Fishing Effort (2007-2025)", "fr": "AFADATA — Effort de Pêche (2007-2025)"},
        "template_name": "Fishing Effort Report",
        "domain": "fisheries",
        "csv_file": "efforts.csv",
        "field_map": {
            "vessel_registration": "vessel_name",
            "effort_type": "effort_type",
            "effort_value": "effort_value",
            "effort_unit": "effort_unit",
            "start_date": "start_date",
            "end_date": "end_date",
            "gear_type": "gear_type",
            "crew_size": "crew_size",
            "fao_area_code": "fao_area_code",
            "country": "_country",
        },
    },
    {
        "key": "trades",
        "name": {"en": "AFADATA — Fish Trade (2007-2025)", "fr": "AFADATA — Commerce Halieutique (2007-2025)"},
        "template_name": "Fish Trade Report",
        "domain": "fisheries",
        "csv_file": "trades.csv",
        "field_map": {
            "species_fao_code": "species",
            "exporter_country": "export_country",
            "importer_country": "import_country",
            "direction": "flow_direction",
            "quantity_kg": "quantity",
            "value_usd": "value_fob_usd",
            "product_state": "product_state",
            "trade_date": "period_start",
            "commodity_code": "hs_code",
            "notes": "remarks",
            "country": "_country",
        },
    },
]


def deterministic_uuid(campaign_key, row_id):
    raw = f"afadata:{campaign_key}:{row_id}"
    h = hashlib.sha256(raw.encode()).hexdigest()
    return str(uuid.UUID(h[:32]))


def campaign_uuid(key):
    return deterministic_uuid("campaign", key)


def run_sql(client, db_host, db_pass, sql):
    """Run SQL via docker psql."""
    chan = client.get_transport().open_session()
    chan.settimeout(30)
    # Use SFTP to avoid escaping issues
    sftp = client.open_sftp()
    tmp_path = f"/tmp/afadata_sql_{os.getpid()}.sql"
    with sftp.file(tmp_path, "w") as f:
        f.write(sql)
    sftp.close()

    chan.exec_command(
        f"echo '{SSH_PASS}' | sudo -S docker run --rm --network host "
        f"-v {tmp_path}:{tmp_path}:ro "
        f"-e PGPASSWORD={db_pass} postgres:16 "
        f"psql -h {db_host} -p 5432 -U aris -d aris -f {tmp_path} 2>&1"
    )
    out = b""
    try:
        while True:
            ch = chan.recv(65536)
            if not ch:
                break
            out += ch
    except:
        pass
    return out.decode(errors="replace").strip()


def run_query(client, db_host, db_pass, sql):
    """Run a single SQL query and return raw text."""
    chan = client.get_transport().open_session()
    chan.settimeout(15)
    escaped = sql.replace("\\", "\\\\").replace('"', '\\"')
    chan.exec_command(
        f"echo '{SSH_PASS}' | sudo -S docker run --rm --network host "
        f"-e PGPASSWORD={db_pass} postgres:16 "
        f'psql -h {db_host} -p 5432 -U aris -d aris -t -A -c "{escaped}"'
    )
    out = b""
    try:
        while True:
            ch = chan.recv(65536)
            if not ch:
                break
            out += ch
    except:
        pass
    return out.decode(errors="replace").strip()


# ══════════════════════════════════════════════════
# STEP 1: SETUP — Create campaigns + link templates
# ══════════════════════════════════════════════════

def do_setup(env_cfg):
    print("\n" + "=" * 60)
    print("  STEP 1: SETUP — Create AFADATA campaigns")
    print("=" * 60)

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(env_cfg["host"], username=SSH_USER, password=SSH_PASS, timeout=15)

    db_host = env_cfg["db_host"]
    db_pass = env_cfg["db_pass"]

    # Find template IDs
    print("\n  Finding form templates...")
    template_ids = {}
    for camp in CAMPAIGNS:
        tpl_name = camp["template_name"]
        r = run_query(c, db_host, db_pass,
            f"SELECT id FROM form_builder.form_templates WHERE name::text ILIKE '%{tpl_name}%' AND status = 'PUBLISHED' LIMIT 1")
        lines = [l.strip() for l in r.split("\n") if len(l.strip()) == 36]
        if lines:
            template_ids[camp["key"]] = lines[-1]
            print(f"    {tpl_name}: {lines[-1][:8]}...")
        else:
            print(f"    {tpl_name}: NOT FOUND")
            template_ids[camp["key"]] = None

    # Create campaigns
    print("\n  Creating campaigns...")
    sql_lines = []
    for camp in CAMPAIGNS:
        cid = campaign_uuid(camp["key"])
        tpl_id = template_ids.get(camp["key"])
        if not tpl_id:
            print(f"    SKIP {camp['key']}: no template found")
            continue

        name_json = json.dumps(camp["name"], ensure_ascii=False).replace("'", "''")
        sql_lines.append(f"""
INSERT INTO collection_campaigns (
    id, name, status, domain, scope,
    form_template_id, form_template_ids,
    start_date, end_date, target_submissions,
    created_by, created_at, updated_at
) VALUES (
    '{cid}', '{name_json}'::jsonb, 'ACTIVE', '{camp["domain"]}', 'CONTINENTAL',
    '{tpl_id}', ARRAY['{tpl_id}'::uuid],
    '2007-01-01', '2025-12-31', 50000,
    '{USER_SUPER_ADMIN}', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE', updated_at = NOW();
""")
        print(f"    {camp['key']}: campaign={cid[:8]}... template={tpl_id[:8]}...")

    if sql_lines:
        result = run_sql(c, db_host, db_pass, "\n".join(sql_lines))
        inserts = result.count("INSERT") + result.count("UPDATE")
        print(f"\n  SQL executed: {inserts} operations")

    # Verify
    print("\n  Verifying campaigns...")
    for camp in CAMPAIGNS:
        cid = campaign_uuid(camp["key"])
        r = run_query(c, db_host, db_pass,
            f"SELECT id, status FROM collection_campaigns WHERE id = '{cid}'")
        exists = len(r.strip()) > 0
        print(f"    {camp['key']}: {'OK' if exists else 'MISSING'}")

    c.close()
    print("\n  SETUP DONE")


# ══════════════════════════════════════════════════
# STEP 2: IMPORT — Load CSV data as submissions
# ══════════════════════════════════════════════════

def do_import(env_cfg):
    print("\n" + "=" * 60)
    print("  STEP 2: IMPORT — Load CSVs as submissions")
    print("=" * 60)

    # Check CSV directory
    csv_dir = LOCAL_CSV_DIR
    if not os.path.isdir(csv_dir):
        print(f"\n  CSV directory not found: {csv_dir}")
        print(f"  Create it and place AfaData CSV exports there:")
        for camp in CAMPAIGNS:
            print(f"    - {camp['csv_file']}")
        print(f"\n  Use the existing _migrate_afadata.py --mode=extract to generate CSVs")
        return

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(env_cfg["host"], username=SSH_USER, password=SSH_PASS, timeout=15)

    db_host = env_cfg["db_host"]
    db_pass = env_cfg["db_pass"]

    # Find template IDs
    template_ids = {}
    for camp in CAMPAIGNS:
        tpl_name = camp["template_name"]
        r = run_query(c, db_host, db_pass,
            f"SELECT id FROM form_builder.form_templates WHERE name::text ILIKE '%{tpl_name}%' AND status = 'PUBLISHED' LIMIT 1")
        lines = [l.strip() for l in r.split("\n") if len(l.strip()) == 36]
        template_ids[camp["key"]] = lines[-1] if lines else None

    for camp in CAMPAIGNS:
        csv_path = os.path.join(csv_dir, camp["csv_file"])
        if not os.path.exists(csv_path):
            print(f"\n  SKIP {camp['key']}: {camp['csv_file']} not found")
            continue

        cid = campaign_uuid(camp["key"])
        tpl_id = template_ids.get(camp["key"])
        if not tpl_id:
            print(f"\n  SKIP {camp['key']}: no template ID")
            continue

        print(f"\n  Importing {camp['csv_file']}...")
        field_map = camp["field_map"]

        # Read CSV
        with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        print(f"    Rows in CSV: {len(rows)}")
        if not rows:
            continue

        # Build submission SQL in batches
        BATCH_SIZE = 500
        total_imported = 0

        for batch_start in range(0, len(rows), BATCH_SIZE):
            batch = rows[batch_start:batch_start + BATCH_SIZE]
            sql_parts = ["BEGIN;"]

            for row in batch:
                # Map CSV columns to form fields
                data = {}
                country_code = None
                for csv_col, form_field in field_map.items():
                    val = row.get(csv_col, "").strip()
                    if not val or val in ("None", "NULL", "\\N"):
                        continue
                    if form_field == "_country":
                        country_code = val
                        data["adm0"] = val
                    else:
                        data[form_field] = val

                if not data:
                    continue

                # Generate deterministic UUID
                row_id = row.get("id", "") or str(batch_start + rows.index(row))
                sub_id = deterministic_uuid(camp["key"], row_id)

                # Determine submitted_at from date fields
                submitted_at = "2025-01-01"
                for date_field in ["capture_date", "harvest_date", "start_date", "period_start", "trade_date", "created_at"]:
                    dv = row.get(date_field, "").strip()
                    if dv and dv not in ("None", "NULL", "\\N") and len(dv) >= 10:
                        submitted_at = dv[:10]
                        break

                data_json = json.dumps(data, ensure_ascii=False).replace("'", "''")
                sql_parts.append(
                    f"INSERT INTO submissions "
                    f"(id, tenant_id, campaign_id, template_id, data, submitted_by, submitted_at, "
                    f"status, data_classification, version, created_at, updated_at) "
                    f"VALUES ('{sub_id}', '{TENANT_AU_IBAR}', '{cid}', '{tpl_id}', "
                    f"'{data_json}'::jsonb, '{USER_SUPER_ADMIN}', '{submitted_at}'::timestamptz, "
                    f"'VALIDATED', 'PARTNER', 1, NOW(), NOW()) "
                    f"ON CONFLICT (id) DO NOTHING;"
                )

            sql_parts.append("COMMIT;")
            result = run_sql(c, db_host, db_pass, "\n".join(sql_parts))
            batch_inserts = result.count("INSERT 0 1")
            total_imported += batch_inserts

            pct = min(100, round((batch_start + len(batch)) / len(rows) * 100))
            print(f"    Batch {batch_start // BATCH_SIZE + 1}: {batch_inserts} inserted ({pct}%)")

        # Verify total
        r = run_query(c, db_host, db_pass,
            f"SELECT count(*) FROM submissions WHERE campaign_id = '{cid}'")
        total_in_db = r.strip().split("\n")[-1].strip()
        print(f"    Total in DB: {total_in_db} submissions")

    c.close()
    print("\n  IMPORT DONE")


# ══════════════════════════════════════════════════
# STEP 3: VERIFY — Check counts
# ══════════════════════════════════════════════════

def do_verify(env_cfg):
    print("\n" + "=" * 60)
    print("  STEP 3: VERIFY — Check submission counts")
    print("=" * 60)

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(env_cfg["host"], username=SSH_USER, password=SSH_PASS, timeout=15)

    db_host = env_cfg["db_host"]
    db_pass = env_cfg["db_pass"]

    print(f"\n  {'Campaign':<45} {'Submissions':>12}")
    print(f"  {'-'*45} {'-'*12}")

    total = 0
    for camp in CAMPAIGNS:
        cid = campaign_uuid(camp["key"])
        r = run_query(c, db_host, db_pass,
            f"SELECT count(*) FROM submissions WHERE campaign_id = '{cid}'")
        count_str = r.strip().split("\n")[-1].strip()
        try:
            count = int(count_str)
        except:
            count = 0
        total += count
        name = camp["name"]["en"][:44]
        print(f"  {name:<45} {count:>12,}")

    print(f"  {'-'*45} {'-'*12}")
    print(f"  {'TOTAL':<45} {total:>12,}")

    # Also check for dashboard linkage
    print(f"\n  Dashboard linkage:")
    for camp in CAMPAIGNS:
        cid = campaign_uuid(camp["key"])
        r = run_query(c, db_host, db_pass,
            f"SELECT count(*) FROM dashboard_builder.dashboards WHERE campaign_id = '{cid}'")
        dcount = r.strip().split("\n")[-1].strip()
        print(f"    {camp['key']}: {dcount} dashboard(s)")

    c.close()
    print("\n  VERIFY DONE")


# ══════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="AfaData → ARIS Migration via Submissions")
    parser.add_argument("--step", required=True, choices=["setup", "import", "verify", "all"])
    parser.add_argument("--env", default="PROD", choices=["PROD", "STG"])
    args = parser.parse_args()

    env_cfg = ENV_CONFIG[args.env]

    print("=" * 60)
    print(f"  AFADATA → ARIS MIGRATION (Submissions)")
    print(f"  Environment: {args.env} ({env_cfg['host']})")
    print(f"  CSV directory: {LOCAL_CSV_DIR}")
    print("=" * 60)

    if args.step in ("setup", "all"):
        do_setup(env_cfg)

    if args.step in ("import", "all"):
        do_import(env_cfg)

    if args.step in ("verify", "all"):
        do_verify(env_cfg)

    print("\n" + "=" * 60)
    print("  ALL DONE")
    print("=" * 60)


if __name__ == "__main__":
    main()
