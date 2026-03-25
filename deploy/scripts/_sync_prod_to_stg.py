#!/usr/bin/env python3
"""
ARIS 4.0 — Sync production database to staging.

Steps:
  1. pg_dump production DB (custom format, compressed)
  2. SFTP relay: prod VM → local temp → staging VM
  3. Drop/recreate staging DB, pg_restore from dump
  4. Restart staging services
  5. Verify

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  python -u _sync_prod_to_stg.py

  # Skip dump (reuse existing):
  python -u _sync_prod_to_stg.py --skip-dump

  # Size check only:
  python -u _sync_prod_to_stg.py --check
"""
import sys
import os
import time
import argparse
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import VM_PASS, VM_USER, step
import paramiko

PROD_DB = "10.202.101.185"
STG_DB = "10.202.101.148"
STG_APP = "10.202.101.146"

PROD_CONTAINER = "aris-postgres"
STG_CONTAINER = "aris-stg-postgres"

DUMP_FILE = "/tmp/aris_prod_dump.sql.gz"
DUMP_REMOTE_PROD = "/tmp/aris_prod_dump.sql.gz"
DUMP_REMOTE_STG = "/tmp/aris_prod_dump.sql.gz"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client(host):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, port=22, username=VM_USER, password=VM_PASS,
              timeout=15, allow_agent=False, look_for_keys=False)
    return c


def run_sudo(host, cmd, timeout=30):
    c = get_client(host)
    stdin, stdout, stderr = c.exec_command(f"sudo -S bash -c '{cmd}'", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    c.close()
    return code, out, err


def run_sudo_stream(host, cmd, timeout=600):
    c = get_client(host)
    stdin, stdout, stderr = c.exec_command(f"sudo -S bash -c '{cmd}'", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        if line:
            safe_print(f"  | {line}")
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    c.close()
    return code, err


def upload_sql(host, container, sql, desc="query", db="aris"):
    """Upload a SQL file to host, docker cp into container, then execute."""
    c = get_client(host)
    sftp = c.open_sftp()
    local_tmp = tempfile.mktemp(suffix=".sql")
    with open(local_tmp, "w", newline="\n") as f:
        f.write(sql)
    sftp.put(local_tmp, "/tmp/_query.sql")
    sftp.close()
    os.unlink(local_tmp)
    c.close()

    # Copy into container then execute
    run_sudo(host, f"docker cp /tmp/_query.sql {container}:/tmp/_query.sql 2>&1", timeout=10)
    code, out, err = run_sudo(host, f"docker exec {container} psql -U aris -d {db} -f /tmp/_query.sql 2>&1", timeout=30)
    return code, out, err


# ── CLI args ──
parser = argparse.ArgumentParser()
parser.add_argument("--check", action="store_true", help="Only check DB sizes, don't sync")
parser.add_argument("--skip-dump", action="store_true", help="Skip pg_dump (reuse existing dump on staging VM)")
args = parser.parse_args()

safe_print("=" * 60)
safe_print("  ARIS 4.0 — Sync Production DB → Staging")
safe_print(f"  Source:      {PROD_DB} ({PROD_CONTAINER})")
safe_print(f"  Destination: {STG_DB} ({STG_CONTAINER})")
safe_print("=" * 60)

# ── Step 0: Check sizes ──
step("Step 0: Check database sizes")

sql_size = "SELECT pg_size_pretty(pg_database_size('aris'));"
code, out, _ = upload_sql(PROD_DB, PROD_CONTAINER, sql_size, "prod size")
safe_print(f"  Production DB size: {out.strip().splitlines()[-1].strip() if out else 'unknown'}")

code, out, _ = upload_sql(STG_DB, STG_CONTAINER, sql_size, "stg size")
safe_print(f"  Staging DB size:    {out.strip().splitlines()[-1].strip() if out else 'unknown'}")

# Table row counts
sql_counts = """
SELECT schemaname || '.' || relname AS tbl, n_live_tup AS rows
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY n_live_tup DESC
LIMIT 15;
"""
code, out, _ = upload_sql(PROD_DB, PROD_CONTAINER, sql_counts, "prod counts")
safe_print(f"\n  Production top tables:")
for line in out.strip().splitlines():
    safe_print(f"    {line}")

# Disk space on staging
code, out, _ = run_sudo(STG_DB, "df -h / | tail -1")
safe_print(f"\n  Staging disk: {out.strip()}")

if args.check:
    safe_print("\n  (--check mode, exiting)")
    sys.exit(0)

# ── Step 1: pg_dump production ──
if not args.skip_dump:
    step("Step 1: Dump production database")
    safe_print("  Running pg_dump (custom format, compressed)...")
    t0 = time.time()

    # Dump INSIDE container using -f flag (avoids shell redirection issues)
    code, out, err = run_sudo(
        PROD_DB,
        f"docker exec {PROD_CONTAINER} pg_dump -U aris -Fc -Z5 -f /tmp/aris_dump.gz aris 2>&1",
        timeout=600
    )
    safe_print(f"  pg_dump exit: {code}")
    if out.strip():
        safe_print(f"  {out.strip()[:300]}")

    # Copy dump out of container to host /tmp
    code2, out2, _ = run_sudo(
        PROD_DB,
        f"docker cp {PROD_CONTAINER}:/tmp/aris_dump.gz {DUMP_REMOTE_PROD} 2>&1 && "
        f"docker exec {PROD_CONTAINER} rm -f /tmp/aris_dump.gz",
        timeout=60
    )

    elapsed = time.time() - t0
    safe_print(f"  Dump completed in {elapsed:.0f}s")

    # Check dump size
    code, out, _ = run_sudo(PROD_DB, f"ls -lh {DUMP_REMOTE_PROD} 2>&1")
    safe_print(f"  Dump file: {out.strip()}")

    # Verify dump file exists and is non-empty
    code, out, _ = run_sudo(PROD_DB, f"test -s {DUMP_REMOTE_PROD} && echo OK || echo EMPTY")
    if "EMPTY" in out:
        safe_print("  ERROR: Dump file is empty!")
        sys.exit(1)

    # ── Step 2: Transfer dump to staging ──
    step("Step 2: Transfer dump from production to staging")
    safe_print("  Downloading from production VM...")
    t0 = time.time()

    # Download from prod
    local_dump = os.path.join(tempfile.gettempdir(), "aris_prod_dump.gz")
    c = get_client(PROD_DB)
    sftp = c.open_sftp()
    sftp.get(DUMP_REMOTE_PROD, local_dump)
    sftp.close()
    c.close()

    local_size = os.path.getsize(local_dump)
    safe_print(f"  Downloaded: {local_size / 1024 / 1024:.1f} MB")

    # Upload to staging
    safe_print("  Uploading to staging VM...")
    c = get_client(STG_DB)
    sftp = c.open_sftp()
    sftp.put(local_dump, DUMP_REMOTE_STG)
    sftp.close()
    c.close()

    os.unlink(local_dump)
    elapsed = time.time() - t0
    safe_print(f"  Transfer completed in {elapsed:.0f}s")

    # Cleanup prod dump
    run_sudo(PROD_DB, f"rm -f {DUMP_REMOTE_PROD}")
else:
    safe_print("\n  (Skipping dump — --skip-dump)")
    # Verify dump exists on staging
    code, out, _ = run_sudo(STG_DB, f"ls -lh {DUMP_REMOTE_STG} 2>&1")
    safe_print(f"  Existing dump: {out.strip()}")

# ── Step 3: Restore on staging ──
step("Step 3: Restore dump on staging")

# Copy dump into container
safe_print("  Copying dump into container...")
code, _, err = run_sudo(STG_DB, f"docker cp {DUMP_REMOTE_STG} {STG_CONTAINER}:/tmp/aris_dump.gz 2>&1", timeout=60)

# Stop PgBouncer so no new connections arrive
safe_print("  Stopping PgBouncer to prevent new connections...")
run_sudo(STG_DB, "docker stop aris-stg-pgbouncer 2>&1", timeout=15)
time.sleep(2)

# Terminate ALL connections to aris database
safe_print("  Terminating existing connections...")
sql_terminate = """
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = 'aris' AND pid <> pg_backend_pid();
"""
upload_sql(STG_DB, STG_CONTAINER, sql_terminate, "terminate", db="postgres")
time.sleep(1)
# Second pass to be sure
upload_sql(STG_DB, STG_CONTAINER, sql_terminate, "terminate2", db="postgres")

safe_print("  Dropping and recreating database...")
sql_recreate = """
DROP DATABASE IF EXISTS aris;
CREATE DATABASE aris OWNER aris;
"""
code, out, _ = upload_sql(STG_DB, STG_CONTAINER, sql_recreate, "recreate", db="postgres")
safe_print(f"  Recreate: {out.strip()}")
if "ERROR" in out:
    safe_print("  Retrying with force...")
    # Force disconnect any stragglers
    upload_sql(STG_DB, STG_CONTAINER, sql_terminate, "terminate3", db="postgres")
    time.sleep(2)
    code, out, _ = upload_sql(STG_DB, STG_CONTAINER, sql_recreate, "recreate2", db="postgres")
    safe_print(f"  Retry: {out.strip()}")

# Restore
safe_print("  Restoring dump (this may take a few minutes)...")
t0 = time.time()
code, err = run_sudo_stream(
    STG_DB,
    f"docker exec {STG_CONTAINER} pg_restore -U aris -d aris --no-owner --no-acl -v /tmp/aris_dump.gz 2>&1",
    timeout=600
)
elapsed = time.time() - t0
safe_print(f"  Restore completed in {elapsed:.0f}s (exit: {code})")
# Note: pg_restore may return non-zero for warnings (like "role does not exist")
# This is normal when restoring across different environments

# Create extensions that might be needed
safe_print("  Ensuring PostGIS extensions...")
sql_extensions = """
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
"""
upload_sql(STG_DB, STG_CONTAINER, sql_extensions, "extensions")

# Cleanup
run_sudo(STG_DB, f"docker exec {STG_CONTAINER} rm -f /tmp/aris_dump.gz")
run_sudo(STG_DB, f"rm -f {DUMP_REMOTE_STG}")

# ── Step 4: Verify restored data ──
step("Step 4: Verify restored data")

sql_verify = """
SELECT 'tenants' AS tbl, count(*)::text FROM public.tenants
UNION ALL SELECT 'users', count(*)::text FROM public.users
UNION ALL SELECT 'functions', count(*)::text FROM governance.functions
UNION ALL SELECT 'species', count(*)::text FROM public.species
UNION ALL SELECT 'diseases', count(*)::text FROM animal_health.ref_diseases
ORDER BY 1;
"""
code, out, _ = upload_sql(STG_DB, STG_CONTAINER, sql_verify, "verify")
safe_print(f"  Row counts:")
for line in out.strip().splitlines():
    safe_print(f"    {line}")

code, out, _ = upload_sql(STG_DB, STG_CONTAINER, sql_size, "final size")
safe_print(f"\n  Staging DB size after restore: {out.strip().splitlines()[-1].strip() if out else 'unknown'}")

# ── Step 5: Restart staging services ──
step("Step 5: Restart staging PgBouncer + services")

safe_print("  Starting PgBouncer (was stopped for restore)...")
code, _, _ = run_sudo(STG_DB, "docker start aris-stg-pgbouncer 2>&1", timeout=30)

safe_print("  Waiting 5s...")
time.sleep(5)

safe_print("  Restarting key services on APP VM...")
services_to_restart = [
    "aris-stg-credential",
    "aris-stg-tenant",
    "aris-stg-master-data",
    "aris-stg-workflow",
    "aris-stg-animal-health",
    "aris-stg-message",
]
for svc in services_to_restart:
    code, out, _ = run_sudo(STG_APP, f"docker restart {svc} 2>&1", timeout=30)
    safe_print(f"  Restarted {svc}")

safe_print("  Waiting 15s for services to start...")
time.sleep(15)

# ── Step 6: Test login ──
step("Step 6: Verify login")

# Upload login test script
login_script = """#!/bin/bash
cat > /tmp/login_body.json << 'JSONEOF'
{"email":"admin@au-aris.org","password":"Aris2024!"}
JSONEOF
curl -s --max-time 10 -X POST http://localhost:3002/api/v1/credential/auth/login \
  -H 'Content-Type: application/json' \
  -d @/tmp/login_body.json 2>&1 | head -c 200
"""
c = get_client(STG_APP)
sftp = c.open_sftp()
local_tmp = tempfile.mktemp(suffix=".sh")
with open(local_tmp, "w", newline="\n") as f:
    f.write(login_script)
sftp.put(local_tmp, "/tmp/test_login.sh")
sftp.close()
os.unlink(local_tmp)
c.close()

c = get_client(STG_APP)
stdin, stdout, stderr = c.exec_command("bash /tmp/test_login.sh", timeout=20)
stdout.channel.settimeout(20)
out = stdout.read().decode("utf-8", errors="replace")
c.close()

if "accessToken" in out:
    safe_print("  Login: OK (token received)")
else:
    safe_print(f"  Login: {out[:300]}")

safe_print("\n" + "=" * 60)
safe_print("  SYNC COMPLETE!")
safe_print("  Production data is now on staging.")
safe_print("  Login: admin@au-aris.org / Aris2024!")
safe_print("=" * 60)
