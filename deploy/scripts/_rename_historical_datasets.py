#!/usr/bin/env python3
"""
ARIS 4.0 — Rename & Merge Historical Datasets on Staging
─────────────────────────────────────────────────────────
1. Renames 6 datasets: removes "ARIS 3 — " prefix
2. Merges 9 "Monthly Animal Health Reports (Part X/9)" into one dataset

Usage:
    python deploy/scripts/_rename_historical_datasets.py
    python deploy/scripts/_rename_historical_datasets.py --env prod
    python deploy/scripts/_rename_historical_datasets.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import paramiko

SSH_USER = os.environ.get("ARIS_DEPLOY_USER", "arisadmin")
SSH_PASS = os.environ.get("ARIS_DEPLOY_PASS", "@u-1baR.0rg$U24")

ENV_CONFIG = {
    "prod": {
        "db_host": "10.202.101.185",
        "db_container": "aris-postgres",
        "db_user": "aris",
        "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
        "db_name": "aris",
    },
    "stg": {
        "db_host": "10.202.101.148",
        "db_container": "aris-stg-postgres",
        "db_user": "aris",
        "db_pass": "Ar1s_Stg_2024!xK9mZ",
        "db_name": "aris",
    },
}

# ── Rename mappings ──────────────────────────────────────────────────
RENAMES = {
    "ARIS 3 — Emergency Disease Reports (2008–2025)": "Emergency Disease Reports (2008–2025)",
    "ARIS 3 — Mass Vaccination Campaigns (2008–2025)": "Mass Vaccination Campaigns (2008–2025)",
    "ARIS 3 — Meat Inspection Reports (2015–2018)": "Meat Inspection Reports (2015–2018)",
    "ARIS 3 — Monthly Vaccination Reports (2008–2025)": "Monthly Vaccination Reports (2008–2025)",
    "ARIS 3 — Animal Population & Composition (2008–2025)": "Animal Population & Composition (2008–2025)",
    "ARIS 3 — Animal Import & Export Records (2014–2017)": "Animal Import & Export Records (2014–2017)",
}

MERGED_NAME = "Monthly Animal Health Reports (2008-2025)"
PART_PATTERN = "ARIS 3 — Monthly Animal Health Reports (Part %"


def ssh_connect(host: str) -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS,
                timeout=20, allow_agent=False, look_for_keys=False)
    return ssh


def db_exec(ssh: paramiko.SSHClient, container: str, db_user: str,
            db_pass: str, db_name: str, sql: str, timeout: int = 120) -> str:
    """Execute SQL via psql in the postgres container."""
    # Escape single quotes in SQL for shell
    escaped_sql = sql.replace("'", "'\\''")
    cmd = (
        f"docker exec -e PGPASSWORD='{db_pass}' {container} "
        f"psql -U {db_user} -d {db_name} -t -A -c '{escaped_sql}'"
    )
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if err and "warning" not in err.lower() and "notice" not in err.lower():
        print(f"  [stderr] {err[:300]}", flush=True)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--env", default="stg", choices=["prod", "stg"])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    cfg = ENV_CONFIG[args.env]
    dry = args.dry_run

    print(f"[env] {args.env} — DB host: {cfg['db_host']}")
    if dry:
        print("[mode] DRY RUN — no changes will be made\n")

    ssh = ssh_connect(cfg["db_host"])
    c, u, p, d = cfg["db_container"], cfg["db_user"], cfg["db_pass"], cfg["db_name"]

    # ── Step 1: List current datasets ────────────────────────────────
    print("\n[1] Listing current datasets...", flush=True)
    rows = db_exec(ssh, c, u, p, d,
                   "SELECT id, name, row_count, table_name FROM historical_dataset ORDER BY name;")
    if not rows:
        print("  No datasets found!")
        ssh.close()
        return

    datasets = []
    for line in rows.split("\n"):
        parts = line.split("|")
        if len(parts) >= 4:
            datasets.append({
                "id": parts[0].strip(),
                "name": parts[1].strip(),
                "row_count": int(parts[2].strip()) if parts[2].strip().isdigit() else 0,
                "table_name": parts[3].strip(),
            })

    print(f"  Found {len(datasets)} datasets:")
    for ds in datasets:
        print(f"    - {ds['name']}  ({ds['row_count']:,} rows, table={ds['table_name']})")

    # ── Step 2: Rename datasets ──────────────────────────────────────
    print("\n[2] Renaming datasets...", flush=True)
    renamed = 0
    for old_name, new_name in RENAMES.items():
        matching = [ds for ds in datasets if ds["name"] == old_name]
        if not matching:
            print(f"  [skip] '{old_name}' — not found")
            continue
        ds = matching[0]
        print(f"  [rename] '{old_name}' → '{new_name}'")
        if not dry:
            escaped_new = new_name.replace("'", "''")
            escaped_old = old_name.replace("'", "''")
            db_exec(ssh, c, u, p, d,
                    f"UPDATE historical_dataset SET name = '{escaped_new}' WHERE name = '{escaped_old}';")
            ds["name"] = new_name
        renamed += 1
    print(f"  {renamed} datasets renamed.")

    # ── Step 3: Merge Monthly Animal Health Report parts ─────────────
    print("\n[3] Merging Monthly Animal Health Report parts...", flush=True)

    # Find the part datasets
    parts = [ds for ds in datasets if "Monthly Animal Health Reports (Part" in ds["name"]]
    parts.sort(key=lambda x: x["name"])

    if not parts:
        print("  [skip] No Monthly Animal Health Report parts found.")
        ssh.close()
        return

    print(f"  Found {len(parts)} parts:")
    total_rows = 0
    for pt in parts:
        print(f"    - {pt['name']}  ({pt['row_count']:,} rows, table={pt['table_name']})")
        total_rows += pt["row_count"]
    print(f"  Total rows to merge: {total_rows:,}")

    if dry:
        print(f"  [dry-run] Would merge into '{MERGED_NAME}'")
        ssh.close()
        return

    # 3a. Get columns from first part (all parts have same schema)
    first_table = parts[0]["table_name"]
    col_info = db_exec(ssh, c, u, p, d,
        f"SELECT column_name, data_type FROM information_schema.columns "
        f"WHERE table_schema = 'historical' AND table_name = '{first_table}' "
        f"ORDER BY ordinal_position;")

    columns = []
    for line in col_info.split("\n"):
        cp = line.split("|")
        if len(cp) >= 2:
            columns.append(cp[0].strip())
    print(f"  Schema: {len(columns)} columns from {first_table}")

    # 3b. Create merged table
    merged_table = "hist_monthly_animal_health_reports_2008_2025_animal_health"
    col_list = ", ".join(f'"{c}"' for c in columns)

    # Check if merged table already exists
    exists = db_exec(ssh, c, u, p, d,
        f"SELECT COUNT(*) FROM information_schema.tables "
        f"WHERE table_schema = 'historical' AND table_name = '{merged_table}';")

    if exists.strip() == "1":
        print(f"  [warn] Merged table 'historical.{merged_table}' already exists — dropping first")
        db_exec(ssh, c, u, p, d, f'DROP TABLE IF EXISTS historical."{merged_table}";')

    # Create merged table with same structure as first part
    print(f"  Creating merged table historical.{merged_table}...")
    db_exec(ssh, c, u, p, d,
        f'CREATE TABLE historical."{merged_table}" (LIKE historical."{first_table}" INCLUDING ALL);')

    # 3c. Insert data from all parts
    for pt in parts:
        tbl = pt["table_name"]
        print(f"  Inserting from {tbl} ({pt['row_count']:,} rows)...", flush=True)
        result = db_exec(ssh, c, u, p, d,
            f'INSERT INTO historical."{merged_table}" ({col_list}) '
            f'SELECT {col_list} FROM historical."{tbl}";',
            timeout=300)
        print(f"    → done", flush=True)

    # Verify row count
    count = db_exec(ssh, c, u, p, d,
        f'SELECT COUNT(*) FROM historical."{merged_table}";')
    actual_rows = int(count.strip()) if count.strip().isdigit() else 0
    print(f"  Merged table row count: {actual_rows:,} (expected: {total_rows:,})")

    # 3d. Create new dataset record (copy metadata from first part)
    first_id = parts[0]["id"]
    first_ds_info = db_exec(ssh, c, u, p, d,
        f"SELECT tenant_id, domain, created_by, file_type FROM historical_dataset WHERE id = '{first_id}';")
    ds_parts = first_ds_info.split("|")
    tenant_id = ds_parts[0].strip()
    domain = ds_parts[1].strip()
    created_by = ds_parts[2].strip()
    file_type = ds_parts[3].strip() if len(ds_parts) > 3 else "xlsx"

    # Sum file sizes
    part_ids = "','".join(pt["id"] for pt in parts)
    total_size = db_exec(ssh, c, u, p, d,
        f"SELECT COALESCE(SUM(file_size_bytes), 0) FROM historical_dataset WHERE id IN ('{part_ids}');")
    total_size = int(total_size.strip()) if total_size.strip().isdigit() else 0

    escaped_merged_name = MERGED_NAME.replace("'", "''")
    merged_desc = (
        "Consolidated disease outbreak reports from 46 African countries. "
        "Extracted from ARIS 3 historical data (4,989 source files). "
        f"{actual_rows:,} rows covering disease surveillance, outbreak tracking, "
        "vaccination status, and control measures (2008-2025)."
    ).replace("'", "''")

    print(f"  Creating merged dataset record '{MERGED_NAME}'...")
    db_exec(ssh, c, u, p, d,
        f"INSERT INTO historical_dataset "
        f"(id, tenant_id, name, description, domain, source_file, file_type, "
        f"file_size_bytes, original_file_name, table_name, row_count, column_count, "
        f"status, tags, created_by, created_at, updated_at) "
        f"VALUES ("
        f"gen_random_uuid(), '{tenant_id}', '{escaped_merged_name}', "
        f"'{merged_desc}', '{domain}', "
        f"'uploads/{merged_table}/merged.xlsx', '{file_type}', "
        f"{total_size}, 'merged.xlsx', '{merged_table}', "
        f"{actual_rows}, {len(columns)}, 'READY', "
        f"ARRAY['historical', 'disease-surveillance', 'outbreaks', '2008-2025'], "
        f"'{created_by}', NOW(), NOW()"
        f");")

    # 3e. Get the new dataset ID
    new_id = db_exec(ssh, c, u, p, d,
        f"SELECT id FROM historical_dataset WHERE name = '{escaped_merged_name}';")
    new_id = new_id.strip()
    print(f"  New dataset ID: {new_id}")

    # 3f. Copy column definitions from first part
    print(f"  Copying column definitions...")
    db_exec(ssh, c, u, p, d,
        f"INSERT INTO dataset_column (id, dataset_id, name, original_name, data_type, "
        f"pg_column_name, nullable, ordinal, sample_values, stats) "
        f"SELECT gen_random_uuid(), '{new_id}', name, original_name, data_type, "
        f"pg_column_name, nullable, ordinal, sample_values, stats "
        f"FROM dataset_column WHERE dataset_id = '{first_id}';")

    # 3g. Delete old part datasets (cascades to columns and analyses)
    print(f"  Deleting {len(parts)} part datasets...", flush=True)
    for pt in parts:
        print(f"    Deleting '{pt['name']}' (id={pt['id']})...")
        db_exec(ssh, c, u, p, d,
            f"DELETE FROM historical_dataset WHERE id = '{pt['id']}';")

    # 3h. Drop old part tables
    print(f"  Dropping {len(parts)} part tables...", flush=True)
    for pt in parts:
        tbl = pt["table_name"]
        print(f"    Dropping historical.{tbl}...")
        db_exec(ssh, c, u, p, d, f'DROP TABLE IF EXISTS historical."{tbl}";')

    # ── Summary ──────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Renamed: {renamed} datasets")
    print(f"  Merged: {len(parts)} parts → '{MERGED_NAME}' ({actual_rows:,} rows)")
    print()

    # Final listing
    print("[final] Current datasets:", flush=True)
    final = db_exec(ssh, c, u, p, d,
        "SELECT name, row_count FROM historical_dataset ORDER BY name;")
    for line in final.split("\n"):
        if line.strip():
            fp = line.split("|")
            if len(fp) >= 2:
                print(f"  - {fp[0].strip()}  ({fp[1].strip()} rows)")

    ssh.close()
    print("\n[done]")


if __name__ == "__main__":
    main()
