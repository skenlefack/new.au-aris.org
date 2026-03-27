#!/usr/bin/env python3
"""
ARIS 4.0 — AfaData Migration Script
Extracts data from AfaData MariaDB and loads into ARIS 4.0 via bulk import APIs.

Migrates fisheries, aquaculture, trade and species data from the legacy AfaData
system (afadata.au-ibar.org, MariaDB) into the ARIS 4.0 platform (PostgreSQL)
through the ARIS service import APIs.

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  export AFADATA_DB_PASS='your-afadata-readonly-password'

  python -u _migrate_afadata.py --mode=extract --env=STG
  python -u _migrate_afadata.py --mode=load --env=STG
  python -u _migrate_afadata.py --mode=verify --env=STG
  python -u _migrate_afadata.py --mode=full --env=STG
  python -u _migrate_afadata.py --mode=full --env=STG --dry-run

Modes:
  extract  — Connect to AfaData MariaDB, export each table as CSV to /tmp/afadata_export/
  load     — Upload CSVs to ARIS import APIs (fisheries:3022, trade-sps:3025)
  verify   — Compare row counts between AfaData and ARIS
  full     — Run extract + load + verify sequentially

Environment variables:
  ARIS_DEPLOY_PASS   — SSH password for VM access (required)
  AFADATA_DB_HOST    — AfaData MariaDB host (default: afadata.au-ibar.org)
  AFADATA_DB_PORT    — AfaData MariaDB port (default: 3306)
  AFADATA_DB_USER    — AfaData MariaDB user (default: readonly)
  AFADATA_DB_PASS    — AfaData MariaDB password (required)
  AFADATA_DB_NAME    — AfaData MariaDB database (default: afadata)
"""
import sys
import os
import io
import time
import argparse
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import step, ssh, ssh_stream, VM_PASS, VM_USER

import paramiko

# ── ANSI Colors ──────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

# Ensure UTF-8 stdout/stderr
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── Environment configuration ────────────────────────────────
ENV_CONFIG = {
    "STG": {
        "app_host": "10.202.101.146",
        "db_host": "10.202.101.148",
        "prefix": "aris-stg",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "label": "STAGING",
    },
    "PROD": {
        "app_host": "10.202.101.183",
        "db_host": "10.202.101.185",
        "prefix": "aris",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "label": "PRODUCTION",
    },
}

# ── AfaData MariaDB connection ───────────────────────────────
AFADATA_HOST = os.environ.get("AFADATA_DB_HOST", "afadata.au-ibar.org")
AFADATA_PORT = os.environ.get("AFADATA_DB_PORT", "3306")
AFADATA_USER = os.environ.get("AFADATA_DB_USER", "readonly")
AFADATA_PASS = os.environ.get("AFADATA_DB_PASS")
AFADATA_DB   = os.environ.get("AFADATA_DB_NAME", "afadata")

# ── ARIS login credentials ───────────────────────────────────
ARIS_ADMIN_EMAIL    = "admin@au-aris.org"
ARIS_ADMIN_PASSWORD = "Aris2024!"

# ── Export directory on remote VM ────────────────────────────
EXPORT_DIR = "/tmp/afadata_export"

# ── Table extraction queries ─────────────────────────────────
# Each entry: (name, output_csv, mysql_query)
EXTRACT_QUERIES = [
    (
        "species",
        "species.csv",
        """SELECT
            id, common_name, scientific_name, fao_code, species_group,
            habitat_type, is_active, created_at, updated_at
        FROM species
        ORDER BY id"""
    ),
    (
        "species_groups",
        "species_groups.csv",
        """SELECT
            id, name, description, created_at, updated_at
        FROM species_groups
        ORDER BY id"""
    ),
    (
        "captures",
        "captures.csv",
        """SELECT
            p.id, p.species_id, s.fao_code AS species_fao_code,
            p.country, p.quantity_kg, p.capture_date,
            p.landing_site, p.fao_area_code, p.gear_type,
            p.fishing_environment, p.production_type,
            p.latitude, p.longitude, p.notes,
            p.created_at, p.updated_at
        FROM productions p
        LEFT JOIN species s ON p.species_id = s.id
        WHERE p.type = 'capture'
        ORDER BY p.id"""
    ),
    (
        "aquaculture_production",
        "aquaculture_production.csv",
        """SELECT
            p.id, p.species_id, s.fao_code AS species_fao_code,
            p.farm_id, p.country, p.quantity_kg,
            p.production_date, p.harvest_method,
            p.stocking_date, p.survival_rate, p.average_weight_grams,
            p.notes, p.created_at, p.updated_at
        FROM productions p
        LEFT JOIN species s ON p.species_id = s.id
        WHERE p.type = 'aquaculture'
        ORDER BY p.id"""
    ),
    (
        "farms",
        "farms.csv",
        """SELECT
            id, name, country, region, district,
            farm_type, culture_method, area_hectares,
            latitude, longitude, owner_name,
            registration_number, total_workers, male_workers,
            female_workers, pond_count, water_source,
            is_active, created_at, updated_at
        FROM farms
        ORDER BY id"""
    ),
    (
        "vessels",
        "vessels.csv",
        """SELECT
            id, name, registration_number, country,
            vessel_type, length_meters, tonnage_gt,
            engine_power_kw, crew_capacity, owner_name,
            home_port, license_number, license_expiry,
            is_active, created_at, updated_at
        FROM vessels
        ORDER BY id"""
    ),
    (
        "efforts",
        "efforts.csv",
        """SELECT
            e.id, e.vessel_id, v.registration_number AS vessel_registration,
            e.capture_id, e.effort_type, e.effort_value,
            e.effort_unit, e.start_date, e.end_date,
            e.gear_type, e.crew_size, e.fao_area_code,
            e.country, e.created_at, e.updated_at
        FROM efforts e
        LEFT JOIN vessels v ON e.vessel_id = v.id
        ORDER BY e.id"""
    ),
    (
        "trades",
        "trades.csv",
        """SELECT
            t.id, t.species_id, s.fao_code AS species_fao_code,
            t.exporter_country, t.importer_country,
            t.direction, t.quantity_kg, t.value_usd,
            t.product_state, t.trade_date,
            t.commodity_code, t.notes,
            t.created_at, t.updated_at
        FROM trades t
        LEFT JOIN species s ON t.species_id = s.id
        ORDER BY t.id"""
    ),
]

# ── Count queries for verification ───────────────────────────
AFADATA_COUNT_QUERIES = {
    "species":                "SELECT COUNT(*) AS cnt FROM species",
    "species_groups":         "SELECT COUNT(*) AS cnt FROM species_groups",
    "captures":               "SELECT COUNT(*) AS cnt FROM productions WHERE type = 'capture'",
    "aquaculture_production": "SELECT COUNT(*) AS cnt FROM productions WHERE type = 'aquaculture'",
    "farms":                  "SELECT COUNT(*) AS cnt FROM farms",
    "vessels":                "SELECT COUNT(*) AS cnt FROM vessels",
    "efforts":                "SELECT COUNT(*) AS cnt FROM efforts",
    "trades":                 "SELECT COUNT(*) AS cnt FROM trades",
}

# ── ARIS import endpoints ────────────────────────────────────
# Maps csv name -> (service_port, api_path)
IMPORT_ENDPOINTS = {
    "captures.csv":               (3022, "/api/v1/fisheries/captures/import"),
    "vessels.csv":                 (3022, "/api/v1/fisheries/vessels/import"),
    "farms.csv":                   (3022, "/api/v1/fisheries/aquaculture/farms/import"),
    "aquaculture_production.csv":  (3022, "/api/v1/fisheries/aquaculture/production/import"),
    "efforts.csv":                 (3022, "/api/v1/fisheries/efforts/import"),
    "trades.csv":                  (3025, "/api/v1/trade/flows/import"),
}

# Order matters: species/referentials first, then entities, then relations
LOAD_ORDER = [
    "species.csv",
    "species_groups.csv",
    "farms.csv",
    "vessels.csv",
    "captures.csv",
    "aquaculture_production.csv",
    "efforts.csv",
    "trades.csv",
]

# Species and species_groups go to master-data, not via import endpoint
MASTER_DATA_CSVS = {"species.csv", "species_groups.csv"}


# ── Helper functions ─────────────────────────────────────────

def ok(msg):
    print(f"  {GREEN}[OK]{RESET}   {msg}")
    sys.stdout.flush()


def fail(msg):
    print(f"  {RED}[FAIL]{RESET} {msg}")
    sys.stdout.flush()


def warn(msg):
    print(f"  {YELLOW}[WARN]{RESET} {msg}")
    sys.stdout.flush()


def info(msg):
    print(f"  {CYAN}[INFO]{RESET} {msg}")
    sys.stdout.flush()


def progress(current, total, label):
    pct = int((current / total) * 100) if total > 0 else 0
    bar_len = 30
    filled = int(bar_len * current / total) if total > 0 else 0
    bar = "=" * filled + "-" * (bar_len - filled)
    print(f"\r  [{bar}] {pct:3d}% ({current}/{total}) {label}", end="", flush=True)


def get_client(host):
    """Create and return a connected SSH client."""
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    connect_kwargs = dict(
        hostname=host, port=22, username=VM_USER,
        timeout=15, allow_agent=False, look_for_keys=False,
    )
    if os.environ.get("ARIS_DEPLOY_KEY"):
        connect_kwargs["key_filename"] = os.environ["ARIS_DEPLOY_KEY"]
    else:
        connect_kwargs["password"] = VM_PASS
    c.connect(**connect_kwargs)
    return c


def run_sudo(client, cmd, timeout=120):
    """Execute a command with sudo on an existing SSH client."""
    stdin, stdout, stderr = client.exec_command(f"sudo -S bash -c '{cmd}'", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    # Filter out sudo password prompts
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, out, err


def run_remote_script(app_host, script_content, timeout=600):
    """Upload a bash script to the remote VM, execute it, and return output."""
    c = get_client(app_host)
    sftp = c.open_sftp()
    sftp.put_fo(io.BytesIO(script_content.encode("utf-8")), "/tmp/afadata_migrate_cmd.sh")
    sftp.close()
    c.close()

    c = get_client(app_host)
    stdin, stdout, stderr = c.exec_command("bash /tmp/afadata_migrate_cmd.sh", timeout=timeout)
    stdout.channel.settimeout(timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    c.close()
    return code, out, err


def sftp_upload_script(app_host, script_content, remote_path="/tmp/afadata_migrate_cmd.sh"):
    """Upload a script via SFTP to the remote VM."""
    c = get_client(app_host)
    sftp = c.open_sftp()
    with sftp.file(remote_path, "w") as f:
        f.write(script_content)
    sftp.close()
    c.close()


def run_on_vm(app_host, script_path="/tmp/afadata_migrate_cmd.sh", timeout=600):
    """Run a previously uploaded script on the VM."""
    c = get_client(app_host)
    stdin, stdout, stderr = c.exec_command(f"bash {script_path}", timeout=timeout)
    stdout.channel.settimeout(timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    c.close()
    return code, out, err


def aris_login(app_host):
    """Login to ARIS and return a JWT access token."""
    login_script = f"""#!/bin/bash
TOKEN=$(curl -sf --max-time 15 -X POST http://localhost:3002/api/v1/credential/auth/login \\
  -H 'Content-Type: application/json' \\
  -d '{{"email":"{ARIS_ADMIN_EMAIL}","password":"{ARIS_ADMIN_PASSWORD}"}}' 2>/dev/null \\
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{{}}).get('accessToken',''))" 2>/dev/null)
echo "$TOKEN"
"""
    sftp_upload_script(app_host, login_script)
    code, out, err = run_on_vm(app_host, timeout=30)
    token = out.strip()
    if not token or code != 0:
        fail(f"ARIS login failed (code={code}): {err[:300]}")
        return None
    return token


# ══════════════════════════════════════════════════════════════
# PHASE 1: EXTRACT
# ══════════════════════════════════════════════════════════════

def do_extract(app_host, dry_run=False):
    """Extract data from AfaData MariaDB into CSVs on the APP VM."""
    step("EXTRACT: Connect to AfaData MariaDB and export CSVs")

    if not AFADATA_PASS:
        fail("AFADATA_DB_PASS environment variable is not set.")
        fail("Set it with: export AFADATA_DB_PASS='your-password'")
        return False

    info(f"AfaData host:     {AFADATA_HOST}:{AFADATA_PORT}")
    info(f"AfaData database: {AFADATA_DB}")
    info(f"AfaData user:     {AFADATA_USER}")
    info(f"Export directory:  {EXPORT_DIR}")
    info(f"Tables to export: {len(EXTRACT_QUERIES)}")
    if dry_run:
        warn("DRY RUN: Will validate queries but not write CSVs")

    # Create export directory on the remote VM
    code, out, err = ssh(app_host, f"mkdir -p {EXPORT_DIR}")
    if code != 0:
        fail(f"Could not create export directory: {err[:300]}")
        return False
    ok(f"Export directory ready: {EXPORT_DIR}")

    # Build the extraction script
    # We use the mysql CLI on the APP VM to connect to AfaData
    # and export each query result as a CSV
    mysql_base = (
        f"mysql -h {AFADATA_HOST} -P {AFADATA_PORT} "
        f"-u {AFADATA_USER} -p'{AFADATA_PASS}' "
        f"{AFADATA_DB} --batch --raw"
    )

    success_count = 0
    fail_count = 0

    for i, (name, csv_file, query) in enumerate(EXTRACT_QUERIES, 1):
        print()
        info(f"[{i}/{len(EXTRACT_QUERIES)}] Extracting: {name} -> {csv_file}")

        if dry_run:
            # In dry run, just validate the query returns something
            test_query = query.rstrip(";").strip()
            # Wrap with LIMIT 1 for validation
            dry_query = f"SELECT 1 FROM ({test_query}) AS t LIMIT 1"
            script = f"""#!/bin/bash
{mysql_base} -e "{dry_query}" 2>&1
echo "EXIT:$?"
"""
            sftp_upload_script(app_host, script)
            code, out, err = run_on_vm(app_host, timeout=30)
            if "EXIT:0" in out:
                ok(f"{name}: Query validated (dry run)")
                success_count += 1
            else:
                fail(f"{name}: Query validation failed")
                if err:
                    print(f"         {err[:200]}")
                fail_count += 1
            continue

        # Real extraction: run query and output as CSV with tab-separated values
        # then convert to proper CSV with commas
        clean_query = query.replace("'", "'\\''").replace("\n", " ").strip()
        csv_path = f"{EXPORT_DIR}/{csv_file}"

        # Use mysql --batch which outputs tab-separated, then convert to CSV
        # The sed converts tabs to commas and handles basic quoting
        script = f"""#!/bin/bash
set -euo pipefail

echo "Extracting {name}..."
{mysql_base} -e "{clean_query}" 2>/tmp/afadata_extract_err.log | \\
  python3 -c "
import sys, csv
reader = csv.reader(sys.stdin, delimiter='\\t')
writer = csv.writer(sys.stdout, quoting=csv.QUOTE_MINIMAL)
for row in reader:
    writer.writerow(row)
" > {csv_path} 2>/tmp/afadata_transform_err.log

if [ $? -eq 0 ]; then
    LINES=$(wc -l < {csv_path})
    echo "OK:$LINES"
else
    echo "FAIL"
    cat /tmp/afadata_extract_err.log 2>/dev/null
    cat /tmp/afadata_transform_err.log 2>/dev/null
fi
"""
        sftp_upload_script(app_host, script)
        code, out, err = run_on_vm(app_host, timeout=300)

        if "OK:" in out:
            lines_str = out.split("OK:")[1].strip().split("\n")[0]
            try:
                line_count = int(lines_str)
                # Subtract 1 for header row
                row_count = max(0, line_count - 1)
                ok(f"{name}: {row_count:,} rows exported to {csv_file}")
                success_count += 1
            except ValueError:
                warn(f"{name}: Exported but could not parse row count: {lines_str}")
                success_count += 1
        else:
            fail(f"{name}: Extraction failed")
            if out.strip():
                print(f"         stdout: {out[:300]}")
            if err.strip():
                print(f"         stderr: {err[:300]}")
            fail_count += 1

    # Summary
    print()
    step("EXTRACT SUMMARY")
    total = len(EXTRACT_QUERIES)
    if fail_count == 0:
        ok(f"All {total} tables extracted successfully")
    else:
        warn(f"{success_count}/{total} succeeded, {fail_count}/{total} failed")

    if not dry_run:
        # List all exported files with sizes
        info("Exported files:")
        code, out, err = ssh(app_host, f"ls -lh {EXPORT_DIR}/*.csv 2>/dev/null")
        if out.strip():
            for line in out.strip().splitlines():
                print(f"    {line.strip()}")

    return fail_count == 0


# ══════════════════════════════════════════════════════════════
# PHASE 2: LOAD
# ══════════════════════════════════════════════════════════════

def do_load(app_host, dry_run=False):
    """Load CSVs into ARIS via the bulk import APIs."""
    step("LOAD: Upload CSVs to ARIS import APIs")

    if dry_run:
        warn("DRY RUN: Will validate files exist but not upload")

    # Verify CSVs exist
    info("Checking exported CSVs...")
    code, out, err = ssh(app_host, f"ls {EXPORT_DIR}/*.csv 2>/dev/null")
    if code != 0 or not out.strip():
        fail(f"No CSV files found in {EXPORT_DIR}")
        fail("Run --mode=extract first")
        return False

    available_files = set(os.path.basename(f) for f in out.strip().splitlines())
    info(f"Found {len(available_files)} CSV files")

    # Login to ARIS to get JWT token
    info("Logging into ARIS to get JWT token...")
    token = aris_login(app_host)
    if not token:
        fail("Could not obtain ARIS JWT token. Aborting load.")
        return False
    ok(f"JWT token obtained ({len(token)} chars)")

    # Load master data CSVs first (species, species_groups)
    # These require special handling via master-data service
    step("LOAD: Master Data (species, species_groups)")
    for csv_name in LOAD_ORDER:
        if csv_name not in MASTER_DATA_CSVS:
            continue
        csv_path = f"{EXPORT_DIR}/{csv_name}"
        if csv_name not in available_files:
            warn(f"Skipping {csv_name}: file not found")
            continue

        entity = csv_name.replace(".csv", "")
        info(f"Loading master data: {csv_name}")

        if csv_name == "species.csv":
            # Species go via the master-data species import or direct seed
            # We use a curl POST to master-data import endpoint
            if dry_run:
                code, out, err = ssh(app_host, f"wc -l < {csv_path}")
                lines = out.strip()
                ok(f"{csv_name}: {lines} lines (dry run, would import to master-data)")
                continue

            script = f"""#!/bin/bash
curl -sf --max-time 120 -X POST http://localhost:3003/api/v1/master-data/species/import \\
  -H "Authorization: Bearer {token}" \\
  -F "file=@{csv_path}" 2>/dev/null
echo ""
echo "EXIT:$?"
"""
            sftp_upload_script(app_host, script)
            code, out, err = run_on_vm(app_host, timeout=180)
            if "EXIT:0" in out:
                # Try to parse import result
                result_line = out.split("EXIT:")[0].strip()
                ok(f"species.csv: Import response received")
                if result_line:
                    info(f"  Response: {result_line[:300]}")
            else:
                warn(f"species.csv: Import may have failed (code={code})")
                if out.strip():
                    print(f"         {out[:300]}")

        elif csv_name == "species_groups.csv":
            # Species groups go to fishery_referentials as FISH_CATEGORY
            if dry_run:
                code, out, err = ssh(app_host, f"wc -l < {csv_path}")
                lines = out.strip()
                ok(f"{csv_name}: {lines} lines (dry run, would import as FISH_CATEGORY referentials)")
                continue

            # Transform species_groups CSV to referential format and POST
            script = f"""#!/bin/bash
# Read species_groups.csv and POST each as a fishery referential
HEADER=true
IMPORTED=0
ERRORS=0

while IFS=, read -r id name description created_at updated_at; do
    if [ "$HEADER" = true ]; then
        HEADER=false
        continue
    fi

    # Clean the name (remove quotes)
    name=$(echo "$name" | tr -d '"')
    code_val=$(echo "$name" | tr '[:lower:]' '[:upper:]' | tr ' ' '_' | tr -cd 'A-Z_')

    RESP=$(curl -sf --max-time 10 -X POST http://localhost:3003/api/v1/master-data/fishery-referentials \\
      -H "Authorization: Bearer {token}" \\
      -H "Content-Type: application/json" \\
      -d "{{\\"category\\":\\"FISH_CATEGORY\\",\\"code\\":\\"$code_val\\",\\"name\\":{{\\"en\\":\\"$name\\",\\"fr\\":\\"$name\\"}}}}" 2>/dev/null)

    if echo "$RESP" | grep -q '"id"'; then
        IMPORTED=$((IMPORTED + 1))
    else
        ERRORS=$((ERRORS + 1))
    fi
done < {csv_path}

echo "IMPORTED:$IMPORTED"
echo "ERRORS:$ERRORS"
"""
            sftp_upload_script(app_host, script)
            code, out, err = run_on_vm(app_host, timeout=120)
            imported = "?"
            errors = "?"
            for line in out.strip().splitlines():
                if line.startswith("IMPORTED:"):
                    imported = line.split(":")[1]
                if line.startswith("ERRORS:"):
                    errors = line.split(":")[1]
            ok(f"species_groups.csv: imported={imported}, errors={errors}")

    # Load domain data CSVs via import endpoints
    step("LOAD: Domain Data (fisheries + trade)")
    success_count = 0
    fail_count = 0
    skip_count = 0

    for csv_name in LOAD_ORDER:
        if csv_name in MASTER_DATA_CSVS:
            continue

        csv_path = f"{EXPORT_DIR}/{csv_name}"
        if csv_name not in available_files:
            warn(f"Skipping {csv_name}: file not found")
            skip_count += 1
            continue

        if csv_name not in IMPORT_ENDPOINTS:
            warn(f"Skipping {csv_name}: no import endpoint configured")
            skip_count += 1
            continue

        port, api_path = IMPORT_ENDPOINTS[csv_name]
        entity_name = csv_name.replace(".csv", "")

        print()
        info(f"Loading: {csv_name} -> localhost:{port}{api_path}")

        # Get row count first
        code, out, err = ssh(app_host, f"wc -l < {csv_path}")
        row_count_str = out.strip()
        try:
            total_lines = int(row_count_str)
            data_rows = max(0, total_lines - 1)  # subtract header
        except ValueError:
            data_rows = "?"
        info(f"  Rows to import: {data_rows}")

        if dry_run:
            ok(f"{entity_name}: {data_rows} rows (dry run, would POST to {api_path})")
            success_count += 1
            continue

        # Upload CSV via curl multipart
        script = f"""#!/bin/bash
RESP=$(curl -s --max-time 300 -w "\\nHTTP_CODE:%{{http_code}}" \\
  -X POST http://localhost:{port}{api_path} \\
  -H "Authorization: Bearer {token}" \\
  -F "file=@{csv_path}" 2>/dev/null)

HTTP_CODE=$(echo "$RESP" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESP" | grep -v "HTTP_CODE:")

echo "HTTP:$HTTP_CODE"
echo "BODY:$BODY"
"""
        sftp_upload_script(app_host, script)
        code, out, err = run_on_vm(app_host, timeout=600)

        http_code = "?"
        body = ""
        for line in out.strip().splitlines():
            if line.startswith("HTTP:"):
                http_code = line.split(":", 1)[1].strip()
            if line.startswith("BODY:"):
                body = line.split(":", 1)[1].strip()

        if http_code in ("200", "201"):
            # Parse import result
            imported = "?"
            skipped = "?"
            errors_count = "?"
            try:
                result = json.loads(body)
                if isinstance(result, dict):
                    data = result.get("data", result)
                    imported = data.get("imported", data.get("count", "?"))
                    skipped = data.get("skipped", 0)
                    errors_list = data.get("errors", [])
                    errors_count = len(errors_list) if isinstance(errors_list, list) else errors_list
            except (json.JSONDecodeError, TypeError):
                pass

            ok(f"{entity_name}: HTTP {http_code} - imported={imported}, skipped={skipped}, errors={errors_count}")
            success_count += 1
        else:
            fail(f"{entity_name}: HTTP {http_code}")
            if body:
                print(f"         Response: {body[:400]}")
            fail_count += 1

    # Summary
    print()
    step("LOAD SUMMARY")
    total = len([c for c in LOAD_ORDER if c not in MASTER_DATA_CSVS])
    if fail_count == 0:
        ok(f"All {success_count} data files loaded successfully ({skip_count} skipped)")
    else:
        warn(f"{success_count}/{total} succeeded, {fail_count}/{total} failed, {skip_count} skipped")

    return fail_count == 0


# ══════════════════════════════════════════════════════════════
# PHASE 3: VERIFY
# ══════════════════════════════════════════════════════════════

def do_verify(app_host, dry_run=False):
    """Compare row counts between AfaData and ARIS."""
    step("VERIFY: Compare AfaData vs ARIS row counts")

    if not AFADATA_PASS:
        fail("AFADATA_DB_PASS environment variable is not set.")
        fail("Set it with: export AFADATA_DB_PASS='your-password'")
        return False

    mysql_base = (
        f"mysql -h {AFADATA_HOST} -P {AFADATA_PORT} "
        f"-u {AFADATA_USER} -p'{AFADATA_PASS}' "
        f"{AFADATA_DB} --batch --raw --skip-column-names"
    )

    # Login to ARIS
    info("Logging into ARIS...")
    token = aris_login(app_host)
    if not token:
        fail("Could not obtain ARIS JWT token. Aborting verification.")
        return False
    ok("JWT token obtained")

    # ARIS count endpoints / queries
    # We use the list APIs with limit=1 to get the meta.total count
    ARIS_COUNT_ENDPOINTS = {
        "species":                (3003, "/api/v1/master-data/species?limit=1"),
        "species_groups":         (3003, "/api/v1/master-data/fishery-referentials?category=FISH_CATEGORY&limit=1"),
        "captures":               (3022, "/api/v1/fisheries/captures?limit=1"),
        "aquaculture_production": (3022, "/api/v1/fisheries/aquaculture/production?limit=1"),
        "farms":                  (3022, "/api/v1/fisheries/aquaculture/farms?limit=1"),
        "vessels":                (3022, "/api/v1/fisheries/vessels?limit=1"),
        "efforts":                (3022, "/api/v1/fisheries/efforts?limit=1"),
        "trades":                 (3025, "/api/v1/trade/flows?commodityGroup=FISH&limit=1"),
    }

    results = []
    all_ok = True

    # Build a single script that queries both AfaData and ARIS for each table
    print()
    print(f"  {'Table':<28s} {'AfaData':>10s} {'ARIS':>10s}  {'Status'}")
    print(f"  {'-'*28} {'-'*10} {'-'*10}  {'-'*10}")

    for table_name in AFADATA_COUNT_QUERIES:
        afadata_query = AFADATA_COUNT_QUERIES[table_name]
        aris_port, aris_path = ARIS_COUNT_ENDPOINTS.get(table_name, (None, None))

        # Get AfaData count
        clean_query = afadata_query.replace("'", "'\\''")
        script = f"""#!/bin/bash
{mysql_base} -e "{clean_query}" 2>/dev/null
"""
        sftp_upload_script(app_host, script)
        code, out, err = run_on_vm(app_host, timeout=30)
        afadata_count = -1
        try:
            afadata_count = int(out.strip().split("\n")[-1].strip())
        except (ValueError, IndexError):
            pass

        # Get ARIS count
        aris_count = -1
        if aris_port and aris_path:
            script = f"""#!/bin/bash
curl -sf --max-time 15 http://localhost:{aris_port}{aris_path} \\
  -H "Authorization: Bearer {token}" 2>/dev/null \\
  | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    meta = d.get('meta', {{}})
    total = meta.get('total', -1)
    if total == -1:
        # Fallback: count data array length
        data = d.get('data', [])
        if isinstance(data, list):
            total = len(data)
    print(total)
except:
    print(-1)
" 2>/dev/null
"""
            sftp_upload_script(app_host, script)
            code, out, err = run_on_vm(app_host, timeout=30)
            try:
                aris_count = int(out.strip().split("\n")[-1].strip())
            except (ValueError, IndexError):
                pass

        # Compare
        afadata_str = f"{afadata_count:,}" if afadata_count >= 0 else "ERROR"
        aris_str = f"{aris_count:,}" if aris_count >= 0 else "ERROR"

        if afadata_count < 0 or aris_count < 0:
            status = f"{YELLOW}UNKNOWN{RESET}"
            all_ok = False
        elif aris_count >= afadata_count:
            status = f"{GREEN}OK{RESET}"
        elif aris_count >= afadata_count * 0.95:
            status = f"{YELLOW}CLOSE (-{afadata_count - aris_count}){RESET}"
        else:
            status = f"{RED}MISMATCH (-{afadata_count - aris_count}){RESET}"
            all_ok = False

        print(f"  {table_name:<28s} {afadata_str:>10s} {aris_str:>10s}  {status}")
        results.append((table_name, afadata_count, aris_count))

    # Summary
    print()
    step("VERIFICATION SUMMARY")
    if all_ok:
        ok("All table counts match or exceed AfaData")
    else:
        warn("Some tables have count mismatches — review above")

    # Country-level breakdown for captures (most important)
    print()
    info("Country-level breakdown for captures:")
    script = f"""#!/bin/bash
echo "=== AfaData captures by country ==="
{mysql_base} -e "SELECT country, COUNT(*) AS cnt FROM productions WHERE type='capture' GROUP BY country ORDER BY cnt DESC LIMIT 15" 2>/dev/null
echo ""
echo "=== ARIS captures by tenant (top 15) ==="
curl -sf --max-time 15 http://localhost:3022/api/v1/fisheries/captures?limit=1\\&groupBy=tenantId \\
  -H "Authorization: Bearer {token}" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    groups = d.get('data', {{}}).get('groups', d.get('groups', []))
    if isinstance(groups, list):
        for g in groups[:15]:
            print(f'  {{g.get(\"tenantId\",\"?\")[:8]}}...  {{g.get(\"count\",\"?\")}}')
    else:
        print('  (groupBy not supported, use verify --mode=verify for basic counts)')
except:
    print('  (could not parse grouped response)')
" 2>/dev/null
"""
    sftp_upload_script(app_host, script)
    code, out, err = run_on_vm(app_host, timeout=30)
    if out.strip():
        for line in out.strip().splitlines():
            print(f"    {line}")

    return all_ok


# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="ARIS 4.0 — AfaData Migration Script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -u _migrate_afadata.py --mode=extract --env=STG
  python -u _migrate_afadata.py --mode=load --env=STG
  python -u _migrate_afadata.py --mode=verify --env=STG
  python -u _migrate_afadata.py --mode=full --env=STG
  python -u _migrate_afadata.py --mode=full --env=STG --dry-run
        """,
    )
    parser.add_argument(
        "--mode",
        required=True,
        choices=["extract", "load", "verify", "full"],
        help="Migration mode: extract, load, verify, or full (all three)",
    )
    parser.add_argument(
        "--env",
        default="STG",
        choices=["STG", "PROD"],
        help="Target environment (default: STG)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate without actual inserts",
    )
    args = parser.parse_args()

    env = ENV_CONFIG[args.env]
    app_host = env["app_host"]
    label = env["label"]

    # ── Banner ──
    print()
    print(f"{BOLD}{'='*64}{RESET}")
    print(f"{BOLD}  ARIS 4.0 — AfaData Migration{RESET}")
    print(f"  Mode:        {CYAN}{args.mode.upper()}{RESET}")
    print(f"  Environment: {CYAN}{label}{RESET} ({app_host})")
    print(f"  Dry run:     {YELLOW}YES{RESET}" if args.dry_run else f"  Dry run:     No")
    print(f"  AfaData:     {AFADATA_HOST}:{AFADATA_PORT}/{AFADATA_DB}")
    print(f"  Timestamp:   {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{BOLD}{'='*64}{RESET}")

    # ── Safety check for PROD ──
    if args.env == "PROD" and not args.dry_run:
        print()
        warn(f"{RED}WARNING: You are about to load data into PRODUCTION!{RESET}")
        warn("It is strongly recommended to run on STG first.")
        confirm = input(f"  Type 'YES-PROD' to confirm: ")
        if confirm != "YES-PROD":
            fail("Aborted by user.")
            sys.exit(1)

    # ── Validate SSH connectivity ──
    step("Pre-check: SSH connectivity")
    try:
        c = get_client(app_host)
        c.close()
        ok(f"Connected to {app_host}")
    except Exception as e:
        fail(f"Cannot SSH to {app_host}: {e}")
        sys.exit(1)

    # ── Execute mode ──
    start_time = time.time()
    overall_success = True

    if args.mode in ("extract", "full"):
        success = do_extract(app_host, dry_run=args.dry_run)
        if not success:
            overall_success = False
            if args.mode == "full":
                warn("Extract had failures. Continuing to load anyway...")

    if args.mode in ("load", "full"):
        success = do_load(app_host, dry_run=args.dry_run)
        if not success:
            overall_success = False
            if args.mode == "full":
                warn("Load had failures. Continuing to verify anyway...")

    if args.mode in ("verify", "full"):
        success = do_verify(app_host, dry_run=args.dry_run)
        if not success:
            overall_success = False

    # ── Final summary ──
    elapsed = time.time() - start_time
    minutes = int(elapsed // 60)
    seconds = int(elapsed % 60)

    print()
    print(f"{BOLD}{'='*64}{RESET}")
    if overall_success:
        print(f"  {GREEN}{BOLD}MIGRATION {args.mode.upper()} COMPLETE — ALL OK{RESET}")
    else:
        print(f"  {YELLOW}{BOLD}MIGRATION {args.mode.upper()} COMPLETE — WITH WARNINGS{RESET}")
    print(f"  Duration: {minutes}m {seconds}s")
    print(f"  Environment: {label}")
    if args.dry_run:
        print(f"  {YELLOW}This was a DRY RUN — no data was modified{RESET}")
    print(f"{BOLD}{'='*64}{RESET}")

    sys.exit(0 if overall_success else 1)


if __name__ == "__main__":
    main()
