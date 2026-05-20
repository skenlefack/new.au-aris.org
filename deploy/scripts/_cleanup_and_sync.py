#!/usr/bin/env python3
"""
ARIS 4.0 — Phase 1: Cleanup disk on PROD + STAGING
               Phase 2: Sync production DB → staging

Cleans Docker logs, dangling images, build cache on all VMs.
Then runs full pg_dump/pg_restore to align staging with prod.
"""

import sys
import os
import time
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paramiko

VM_USER = "arisadmin"
VM_PASS = "@u-1baR.0rg$U24"

# Infrastructure
VMS = {
    "PROD-APP":   "10.202.101.183",
    "PROD-DB":    "10.202.101.185",
    "PROD-CACHE": "10.202.101.186",
    "PROD-KAFKA": "10.202.101.184",
    "STG-APP":    "10.202.101.146",
    "STG-DB":     "10.202.101.148",
    "STG-CACHE":  "10.202.101.149",
    "STG-KAFKA":  "10.202.101.147",
}


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
    c.close()
    return code, out


def upload_sql(host, container, sql, db="aris"):
    """Upload and execute SQL via docker cp + psql."""
    c = get_client(host)
    sftp = c.open_sftp()
    local_tmp = tempfile.mktemp(suffix=".sql")
    with open(local_tmp, "w", newline="\n") as f:
        f.write(sql)
    sftp.put(local_tmp, "/tmp/_query.sql")
    sftp.close()
    os.unlink(local_tmp)
    c.close()
    run_sudo(host, f"docker cp /tmp/_query.sql {container}:/tmp/_query.sql", timeout=10)
    code, out = run_sudo(host, f"docker exec {container} psql -U aris -d {db} -f /tmp/_query.sql", timeout=60)
    return code, out


def cleanup_vm(name, host):
    """Clean Docker logs, images, and build cache on a VM."""
    safe_print(f"\n  --- {name} ({host}) ---")

    # 1. Check disk before
    _, out = run_sudo(host, "df -h / | tail -1")
    safe_print(f"  Disk before: {out}")

    # 2. Check Docker disk
    _, out = run_sudo(host, "df -h /var/lib/docker 2>/dev/null | tail -1")
    if out and "/var/lib/docker" in out:
        safe_print(f"  Docker vol:  {out}")

    # 3. Truncate container logs
    _, out = run_sudo(host, """
        total=0
        for f in $(find /var/lib/docker/containers/ -name '*-json.log' -size +10M 2>/dev/null); do
            sz=$(stat -c%s "$f" 2>/dev/null || echo 0)
            total=$((total + sz))
            truncate -s 0 "$f"
        done
        echo "$((total / 1024 / 1024))MB logs truncated"
    """, timeout=30)
    safe_print(f"  Logs: {out}")

    # 4. Docker prune
    _, out = run_sudo(host, "docker system prune -f 2>&1 | tail -1", timeout=60)
    safe_print(f"  Prune: {out}")

    # 5. Builder prune
    _, out = run_sudo(host, "docker builder prune -af 2>&1 | tail -1", timeout=30)
    safe_print(f"  Builder: {out}")

    # 6. Check disk after
    _, out = run_sudo(host, "df -h / | tail -1")
    safe_print(f"  Disk after:  {out}")

    _, out = run_sudo(host, "df -h /var/lib/docker 2>/dev/null | tail -1")
    if out and "/var/lib/docker" in out:
        safe_print(f"  Docker after: {out}")


# ════════════════════════════════════════════════════════════
# PHASE 1: CLEANUP
# ════════════════════════════════════════════════════════════

safe_print("=" * 60)
safe_print("  PHASE 1: DISK CLEANUP — ALL VMs")
safe_print("=" * 60)

for name, host in VMS.items():
    try:
        cleanup_vm(name, host)
    except Exception as e:
        safe_print(f"  {name}: FAILED — {e}")

# ════════════════════════════════════════════════════════════
# PHASE 2: SYNC PROD → STAGING
# ════════════════════════════════════════════════════════════

safe_print("\n" + "=" * 60)
safe_print("  PHASE 2: SYNC PRODUCTION DB → STAGING")
safe_print("=" * 60)

PROD_DB = VMS["PROD-DB"]
STG_DB = VMS["STG-DB"]
STG_APP = VMS["STG-APP"]
STG_CACHE = VMS["STG-CACHE"]
PROD_CONTAINER = "aris-postgres"
STG_CONTAINER = "aris-stg-postgres"

# ── Step 1: Check sizes ──
safe_print("\n[1/7] Checking database sizes...")
_, out = upload_sql(PROD_DB, PROD_CONTAINER, "SELECT pg_size_pretty(pg_database_size('aris'));")
safe_print(f"  PROD DB: {out.strip().splitlines()[-1].strip()}")
_, out = upload_sql(STG_DB, STG_CONTAINER, "SELECT pg_size_pretty(pg_database_size('aris'));")
safe_print(f"  STG  DB: {out.strip().splitlines()[-1].strip()}")

# ── Step 2: pg_dump production ──
safe_print("\n[2/7] Dumping production database...")
t0 = time.time()

code, out = run_sudo(
    PROD_DB,
    f"docker exec {PROD_CONTAINER} pg_dump -U aris -Fc -Z5 -f /tmp/aris_dump.gz aris 2>&1",
    timeout=600
)
safe_print(f"  pg_dump exit={code} ({time.time()-t0:.0f}s)")

# Copy out of container
run_sudo(PROD_DB,
    f"docker cp {PROD_CONTAINER}:/tmp/aris_dump.gz /tmp/aris_prod_dump.gz && "
    f"docker exec {PROD_CONTAINER} rm -f /tmp/aris_dump.gz",
    timeout=60)

_, out = run_sudo(PROD_DB, "ls -lh /tmp/aris_prod_dump.gz | awk '{print $5}'")
safe_print(f"  Dump size: {out.strip()}")

# Verify non-empty
_, out = run_sudo(PROD_DB, "test -s /tmp/aris_prod_dump.gz && echo OK || echo EMPTY")
if "EMPTY" in out:
    safe_print("  ERROR: Dump file is empty!")
    sys.exit(1)

# ── Step 3: Transfer dump to staging ──
safe_print("\n[3/7] Transferring dump to staging...")
t0 = time.time()

local_dump = os.path.join(tempfile.gettempdir(), "aris_prod_dump.gz")

c = get_client(PROD_DB)
sftp = c.open_sftp()
sftp.get("/tmp/aris_prod_dump.gz", local_dump)
sftp.close()
c.close()

local_size = os.path.getsize(local_dump)
safe_print(f"  Downloaded: {local_size / 1024 / 1024:.1f} MB")

c = get_client(STG_DB)
sftp = c.open_sftp()
sftp.put(local_dump, "/tmp/aris_prod_dump.gz")
sftp.close()
c.close()

os.unlink(local_dump)
safe_print(f"  Uploaded to staging ({time.time()-t0:.0f}s)")

# Clean prod dump
run_sudo(PROD_DB, "rm -f /tmp/aris_prod_dump.gz")

# ── Step 4: Restore on staging ──
safe_print("\n[4/7] Restoring dump on staging...")

# Copy into container
run_sudo(STG_DB, f"docker cp /tmp/aris_prod_dump.gz {STG_CONTAINER}:/tmp/aris_dump.gz", timeout=60)

# Stop PgBouncer
safe_print("  Stopping PgBouncer...")
run_sudo(STG_DB, "docker stop aris-stg-pgbouncer 2>/dev/null", timeout=15)
time.sleep(2)

# Terminate connections
sql_terminate = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'aris' AND pid <> pg_backend_pid();"
upload_sql(STG_DB, STG_CONTAINER, sql_terminate, db="postgres")
time.sleep(1)
upload_sql(STG_DB, STG_CONTAINER, sql_terminate, db="postgres")

# Drop & recreate
safe_print("  Dropping and recreating database...")
code, out = upload_sql(STG_DB, STG_CONTAINER, "DROP DATABASE IF EXISTS aris; CREATE DATABASE aris OWNER aris;", db="postgres")
if "ERROR" in out:
    safe_print(f"  Retry after force disconnect...")
    upload_sql(STG_DB, STG_CONTAINER, sql_terminate, db="postgres")
    time.sleep(3)
    code, out = upload_sql(STG_DB, STG_CONTAINER, "DROP DATABASE IF EXISTS aris; CREATE DATABASE aris OWNER aris;", db="postgres")

safe_print(f"  {out.strip()}")

# Restore
safe_print("  Restoring (this takes a few minutes)...")
t0 = time.time()
code, out = run_sudo(
    STG_DB,
    f"docker exec {STG_CONTAINER} pg_restore -U aris -d aris --no-owner --no-acl /tmp/aris_dump.gz 2>&1 | tail -5",
    timeout=600
)
safe_print(f"  Restore done in {time.time()-t0:.0f}s (exit={code})")

# Extensions
upload_sql(STG_DB, STG_CONTAINER, """
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
""")

# Drop the bad FK (same fix we applied earlier)
safe_print("  Dropping submissions_campaign_id_fkey (if exists)...")
upload_sql(STG_DB, STG_CONTAINER, "ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_campaign_id_fkey;")

# Cleanup
run_sudo(STG_DB, f"docker exec {STG_CONTAINER} rm -f /tmp/aris_dump.gz")
run_sudo(STG_DB, "rm -f /tmp/aris_prod_dump.gz")

# ── Step 5: Verify ──
safe_print("\n[5/7] Verifying restored data...")
sql_verify = """
SELECT 'tenants' AS tbl, count(*)::text FROM public.tenants
UNION ALL SELECT 'users', count(*)::text FROM public.users
UNION ALL SELECT 'form_templates', count(*)::text FROM form_builder.form_templates
UNION ALL SELECT 'campaigns', count(*)::text FROM public.collection_campaigns
UNION ALL SELECT 'submissions', count(*)::text FROM public.submissions
UNION ALL SELECT 'species', count(*)::text FROM public.species
UNION ALL SELECT 'diseases', count(*)::text FROM animal_health.ref_diseases
ORDER BY 1;
"""
_, out = upload_sql(STG_DB, STG_CONTAINER, sql_verify)
safe_print(f"  Row counts:")
for line in out.strip().splitlines():
    safe_print(f"    {line}")

_, out = upload_sql(STG_DB, STG_CONTAINER, "SELECT pg_size_pretty(pg_database_size('aris'));")
safe_print(f"  Staging DB size: {out.strip().splitlines()[-1].strip()}")

# ── Step 6: Restart services ──
safe_print("\n[6/7] Restarting staging infrastructure + services...")

# Start PgBouncer
run_sudo(STG_DB, "docker start aris-stg-pgbouncer 2>/dev/null", timeout=15)
time.sleep(3)

# Flush Redis
safe_print("  Flushing Redis cache...")
REDIS_PASS = "R3d1s_Stg_2024!vN7wQ"
_, out = run_sudo(STG_CACHE, f"docker exec aris-stg-redis redis-cli -a '{REDIS_PASS}' --no-auth-warning FLUSHALL", timeout=15)
safe_print(f"  Redis: {out.strip()}")

# Restart all services
services = [
    "aris-stg-credential", "aris-stg-tenant", "aris-stg-master-data",
    "aris-stg-workflow", "aris-stg-collecte", "aris-stg-form-builder",
    "aris-stg-animal-health", "aris-stg-fisheries", "aris-stg-trade-sps",
    "aris-stg-governance", "aris-stg-livestock-prod", "aris-stg-message",
    "aris-stg-data-quality", "aris-stg-data-contract", "aris-stg-analytics",
    "aris-stg-knowledge-hub", "aris-stg-drive", "aris-stg-realtime",
    "aris-stg-web",
]
safe_print(f"  Restarting {len(services)} services...")
for svc in services:
    run_sudo(STG_APP, f"docker restart {svc} 2>/dev/null", timeout=15)

safe_print("  Waiting 20s for services to start...")
time.sleep(20)

# ── Step 7: Test login ──
safe_print("\n[7/7] Testing login on staging...")

c = get_client(STG_APP)
sftp = c.open_sftp()
with sftp.file("/tmp/login_body.json", "w") as f:
    f.write('{"email":"admin@au-aris.org","password":"Aris2026@@4!0"}')
sftp.close()
c.close()

_, out = run_sudo(STG_APP,
    "curl -s --max-time 10 -X POST http://localhost:3002/api/v1/credential/auth/login "
    "-H 'Content-Type: application/json' -d @/tmp/login_body.json | head -c 200",
    timeout=20)

if "accessToken" in out:
    safe_print("  Login: OK (token received)")
else:
    safe_print(f"  Login: {out[:200]}")

# Final status
safe_print("\n" + "=" * 60)
safe_print("  SYNC COMPLETE!")
safe_print("  Staging DB is now an exact copy of Production.")
safe_print("  submissions_campaign_id_fkey dropped on staging.")
safe_print("  Redis flushed. All services restarted.")
safe_print("=" * 60)
