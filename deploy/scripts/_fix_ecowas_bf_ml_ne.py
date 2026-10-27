#!/usr/bin/env python3
"""
Move Burkina Faso (BF), Mali (ML), Niger (NE) from ECOWAS to CEN-SAD.
These 3 countries withdrew from ECOWAS and should only appear under CEN-SAD.

Updates:
  - tenant.tenants: parent_id → CEN-SAD, rec_code → CENSAD
  - Flushes Redis tenant cache so changes are visible immediately

Targets: PROD + STAGING
"""
import paramiko, sys, time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = {
    "STAGING": {
        "db_host": "10.202.101.148",
        "app_host": "10.202.101.146",
        "pg_container": "aris-stg-postgres",
        "redis_container": "aris-stg-redis",
        "tenant_container": "aris-stg-tenant",
    },
    "PRODUCTION": {
        "db_host": "10.202.101.185",
        "app_host": "10.202.101.183",
        "pg_container": "aris-postgres",
        "redis_container": "aris-redis",
        "tenant_container": "aris-tenant",
    },
}

CENSAD_TENANT_ID = "00000000-0000-4000-a000-000000000070"
ECOWAS_TENANT_ID = "00000000-0000-4000-a000-000000000020"
COUNTRY_CODES = ("BF", "ML", "NE")

SQL_CHECK = """
-- 1) tenant table
SELECT 'tenant' AS src, t.code, t.name, t.rec_code, t.parent_id::text
FROM public.tenants t
WHERE t.code IN ('BF', 'ML', 'NE')
ORDER BY t.code;

-- 2) governance.country_recs pivot
SELECT 'country_rec' AS src, c.code, r.code AS rec_code, cr.is_active::text, cr.id::text
FROM governance.country_recs cr
JOIN governance.countries c ON c.id = cr.country_id
JOIN governance.recs r ON r.id = cr.rec_id
WHERE c.code IN ('BF', 'ML', 'NE')
ORDER BY c.code, r.code;
"""

SQL_UPDATE = f"""
BEGIN;

-- 1) Fix tenant hierarchy (already done if re-run)
UPDATE public.tenants
SET parent_id = '{CENSAD_TENANT_ID}',
    rec_code  = 'CENSAD',
    updated_at = NOW()
WHERE code IN ('BF', 'ML', 'NE')
  AND parent_id = '{ECOWAS_TENANT_ID}';

-- 2) Remove BF/ML/NE from ECOWAS in governance.country_recs (case-insensitive)
DELETE FROM governance.country_recs
WHERE country_id IN (SELECT id FROM governance.countries WHERE code IN ('BF', 'ML', 'NE'))
  AND rec_id IN (SELECT id FROM governance.recs WHERE LOWER(code) = 'ecowas');

-- 3) Ensure BF/ML/NE are in CEN-SAD (insert if not exists)
INSERT INTO governance.country_recs (id, country_id, rec_id, is_active)
SELECT gen_random_uuid(),
       c.id,
       r.id,
       true
FROM governance.countries c
CROSS JOIN (SELECT id FROM governance.recs WHERE LOWER(code) = 'censad') r
WHERE c.code IN ('BF', 'ML', 'NE')
  AND NOT EXISTS (
    SELECT 1 FROM governance.country_recs cr2
    WHERE cr2.country_id = c.id
      AND cr2.rec_id = r.id
  );

COMMIT;
"""

SQL_VERIFY = SQL_CHECK


def ssh_connect(host):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)
    return ssh


def run_sql(ssh, sql, pg_container, timeout=30):
    tmp = "/tmp/_fix_ecowas.sql"
    sftp = ssh.open_sftp()
    with sftp.file(tmp, "w") as f:
        f.write(sql)
    sftp.close()
    ch = ssh.get_transport().open_session()
    ch.settimeout(timeout)
    cmd = f"sudo -S bash -c 'cat {tmp} | docker exec -i {pg_container} psql -U aris -d aris 2>&1; rm -f {tmp}'"
    ch.exec_command(cmd)
    ch.sendall((SSH_PASS + "\n").encode())
    time.sleep(0.5)
    out = b""
    while ch.recv_ready() or not ch.exit_status_ready():
        if ch.recv_ready():
            out += ch.recv(65536)
        else:
            time.sleep(0.3)
        if ch.exit_status_ready() and not ch.recv_ready():
            break
    return "\n".join(
        l for l in out.decode("utf-8", "replace").splitlines()
        if "[sudo]" not in l and "password" not in l.lower()
    )


def flush_redis(ssh, redis_container):
    """Flush tenant-related cache keys so the API serves fresh data."""
    ch = ssh.get_transport().open_session()
    ch.settimeout(15)
    # Delete all tenant cache keys
    cmd = (
        f"sudo -S bash -c '"
        f"docker exec {redis_container} redis-cli KEYS \"aris:tenant*\" | "
        f"xargs -r docker exec -i {redis_container} redis-cli DEL 2>&1"
        f"'"
    )
    ch.exec_command(cmd)
    ch.sendall((SSH_PASS + "\n").encode())
    time.sleep(1)
    out = b""
    while ch.recv_ready() or not ch.exit_status_ready():
        if ch.recv_ready():
            out += ch.recv(65536)
        else:
            time.sleep(0.3)
        if ch.exit_status_ready() and not ch.recv_ready():
            break
    return out.decode("utf-8", "replace").strip()


def process_env(env_name, cfg):
    print(f"\n{'=' * 60}")
    print(f"  {env_name}")
    print(f"{'=' * 60}")

    # --- Step 1: Check current state ---
    print(f"\n[1/4] Connecting to DB ({cfg['db_host']})...")
    db_ssh = ssh_connect(cfg["db_host"])

    print("[2/4] Current state of BF, ML, NE:")
    result = run_sql(db_ssh, SQL_CHECK, cfg["pg_container"])
    print(result)

    # Check if already fully migrated (tenant + country_recs)
    if "CENSAD" in result and "ECOWAS" not in result and "ecowas" not in result:
        print(f"\n  ✓ Already under CEN-SAD — skipping {env_name}")
        db_ssh.close()
        return True

    # --- Step 2: Update ---
    print("\n[3/4] Moving BF, ML, NE → CEN-SAD...")
    result = run_sql(db_ssh, SQL_UPDATE, cfg["pg_container"])
    print(result)

    # --- Step 3: Verify ---
    print("\n[4/4] Verifying...")
    result = run_sql(db_ssh, SQL_VERIFY, cfg["pg_container"])
    print(result)
    db_ssh.close()

    ok = all(code not in result or "CENSAD" in result for code in COUNTRY_CODES)

    # --- Step 4: Flush Redis cache ---
    if ok:
        print(f"\n  Flushing Redis tenant cache on {cfg['app_host']}...")
        try:
            app_ssh = ssh_connect(cfg["app_host"])
            flush_result = flush_redis(app_ssh, cfg["redis_container"])
            print(f"  Redis: {flush_result or 'flushed'}")
            app_ssh.close()
        except Exception as e:
            print(f"  ⚠ Redis flush failed ({e}) — cache will expire in ~60s")

    status = "✓ OK" if ok else "✗ FAILED"
    print(f"\n  {env_name}: {status}")
    return ok


def main():
    print("=" * 60)
    print("  ECOWAS → CEN-SAD: Burkina Faso, Mali, Niger")
    print("=" * 60)

    results = {}
    for env_name, cfg in ENVS.items():
        try:
            results[env_name] = process_env(env_name, cfg)
        except Exception as e:
            print(f"\n  ✗ {env_name} ERROR: {e}")
            results[env_name] = False

    print(f"\n{'=' * 60}")
    print("  SUMMARY")
    print(f"{'=' * 60}")
    for env_name, ok in results.items():
        print(f"  {env_name}: {'✓ OK' if ok else '✗ FAILED'}")
    print()


if __name__ == "__main__":
    main()
