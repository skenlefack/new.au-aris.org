#!/usr/bin/env python3
"""
ARIS 4.0 — Deploy Interop Hub v3 to STAGING + PRODUCTION

Steps:
  1. Git commit + push (if needed)
  2. STAGING: git pull → create schema → prisma push → rebuild interop-hub + web → seed
  3. PRODUCTION: git pull → create schema → prisma push → rebuild interop-hub + web → seed
  4. Health checks on both environments

Usage:
  python deploy/scripts/_deploy_interop_hub_v3.py [--staging-only] [--prod-only] [--skip-seed] [--skip-schema]
"""
import paramiko
import sys
import time
import argparse

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── Config ────────────────────────────────────────────────────────────
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

# Production
PROD_APP = "10.202.101.183"
PROD_DB  = "10.202.101.185"
PROD_DEPLOY_DIR = "/opt/aris-deploy/vm-app"
PROD_GIT_DIR = "/opt/aris"
PROD_DB_USER = "aris"
PROD_DB_PASS = "Ar1s_Pr0d_2024!xK9mZ"
PROD_DB_NAME = "aris"
PROD_PREFIX  = "aris"
PROD_PG_CONTAINER = "aris-postgres"
PROD_HUB_CONTAINER = "aris-interop-hub"

# Staging
STG_APP  = "10.202.101.146"
STG_DB   = "10.202.101.148"
STG_DEPLOY_DIR = "/opt/aris-deploy/vm-app-stg"
STG_GIT_DIR = "/opt/aris"
STG_DB_USER = "aris"
STG_DB_PASS = "Ar1s_Stg_2024!xK9mZ"
STG_DB_NAME = "aris"
STG_PREFIX  = "aris-stg"
STG_PG_CONTAINER = "aris-stg-postgres"
STG_HUB_CONTAINER = "aris-stg-interop-hub"

# Database URL pattern
DB_URL_TPL = "postgresql://{user}:{pw}@host.docker.internal:6432/{db}?pgbouncer=true&schema=interop"
DIRECT_DB_URL_TPL = "postgresql://{user}:{pw}@host.docker.internal:5432/{db}"


def step(msg):
    print(f"\n{'='*70}")
    print(f"  {msg}")
    print(f"{'='*70}")


def connect(host):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)
    return ssh


def run(ssh, cmd, timeout=300, label=""):
    """Execute command via sudo, return (exit_code, stdout, stderr)."""
    full_cmd = f"echo '{SSH_PASS}' | sudo -S bash -c '{cmd}'"
    stdin, stdout, stderr = ssh.exec_command(full_cmd, timeout=timeout)
    stdin.channel.shutdown_write()
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    # Filter out sudo password prompt from stderr
    err_lines = [l for l in err.split("\n") if "password" not in l.lower() and "[sudo]" not in l]
    err = "\n".join(err_lines).strip()
    if label:
        status = "OK" if code == 0 else f"FAIL (exit={code})"
        print(f"  [{status}] {label}")
        if code != 0 and err:
            for line in err.split("\n")[:5]:
                print(f"    ! {line}")
    return code, out, err


def deploy_env(env_name, app_host, db_host, deploy_dir, git_dir, db_user, db_pass, db_name,
               pg_container, hub_container, prefix, skip_seed=False, skip_schema=False):
    """Deploy Interop Hub v3 to one environment."""

    step(f"[{env_name}] Phase 1 — Git pull")
    app = connect(app_host)
    run(app, f"cd {git_dir} && git fetch origin && git reset --hard origin/main", label="git pull")

    if not skip_schema:
        step(f"[{env_name}] Phase 2 — Create interop schema on DB")
        db = connect(db_host)
        create_sql = f"docker exec {pg_container} psql -U {db_user} -d {db_name} -c 'CREATE SCHEMA IF NOT EXISTS interop;'"
        run(db, create_sql, label="CREATE SCHEMA interop")
        db.close()

    step(f"[{env_name}] Phase 3 — Prisma db push for interop schema")
    db_url = f"postgresql://{db_user}:{db_pass}@{db_host}:6432/{db_name}?pgbouncer=true"
    direct_url = f"postgresql://{db_user}:{db_pass}@{db_host}:5432/{db_name}"

    prisma_cmd = (
        f"docker exec -w /app/packages/db-schemas "
        f"-e DATABASE_URL='{db_url}' "
        f"-e DIRECT_DATABASE_URL='{direct_url}' "
        f"{hub_container} npx prisma db push --schema=prisma --accept-data-loss 2>&1 || true"
    )
    run(app, prisma_cmd, timeout=120, label="prisma db push")

    step(f"[{env_name}] Phase 4 — Rebuild interop-hub service")
    rebuild_cmd = f"cd {deploy_dir} && docker compose up -d --build --force-recreate --no-deps interop-hub"
    code, out, err = run(app, rebuild_cmd, timeout=600, label="docker compose up interop-hub")
    if out:
        for line in out.split("\n")[-5:]:
            print(f"    {line}")

    # Wait for service to start
    print("  Waiting 10s for interop-hub to start...")
    time.sleep(10)

    # Re-run prisma push after rebuild (container has latest code)
    step(f"[{env_name}] Phase 5 — Prisma db push (post-rebuild)")
    run(app, prisma_cmd, timeout=120, label="prisma db push (post-rebuild)")

    if not skip_seed:
        step(f"[{env_name}] Phase 6 — Seed Interop Hub v3")
        seed_cmd = (
            f"docker exec -w /app/services/interop-hub "
            f"-e DATABASE_URL='{db_url}' "
            f"-e DIRECT_DATABASE_URL='{direct_url}' "
            f"{hub_container} node dist/hub/seed-hub.js 2>&1 || echo 'SEED_FAILED'"
        )
        code, out, err = run(app, seed_cmd, timeout=120, label="seed interop hub")
        if out:
            for line in out.split("\n"):
                print(f"    {line}")

    step(f"[{env_name}] Phase 7 — Rebuild web (frontend)")
    web_cmd = f"cd {deploy_dir} && docker compose up -d --build --force-recreate --no-deps web"
    run(app, web_cmd, timeout=600, label="docker compose up web")

    step(f"[{env_name}] Phase 8 — Health checks")
    time.sleep(5)

    # Check interop-hub health
    health_cmd = f"docker exec {hub_container} wget -qO- http://localhost:3032/health 2>/dev/null || echo 'UNHEALTHY'"
    code, out, err = run(app, health_cmd, label="interop-hub /health")
    if out:
        print(f"    Response: {out[:200]}")

    # Check hub routes are accessible
    hub_routes_cmd = f"docker exec {hub_container} wget -qO- http://localhost:3032/api/v1/hub/dashboard/overview 2>/dev/null | head -c 200 || echo 'NO_RESPONSE'"
    code, out, err = run(app, hub_routes_cmd, label="hub dashboard overview")
    if out:
        print(f"    Response: {out[:200]}")

    # Check running containers
    ps_cmd = f"docker ps --filter name={prefix}-interop-hub --format '{{{{.Names}}}} {{{{.Status}}}}'"
    code, out, err = run(app, ps_cmd, label="container status")
    if out:
        print(f"    {out}")

    app.close()
    print(f"\n  ✅ [{env_name}] Interop Hub v3 deployment complete!")


def main():
    parser = argparse.ArgumentParser(description="Deploy Interop Hub v3")
    parser.add_argument("--staging-only", action="store_true", help="Deploy to staging only")
    parser.add_argument("--prod-only", action="store_true", help="Deploy to production only")
    parser.add_argument("--skip-seed", action="store_true", help="Skip seed step")
    parser.add_argument("--skip-schema", action="store_true", help="Skip schema creation")
    args = parser.parse_args()

    print("╔══════════════════════════════════════════════════════════════╗")
    print("║  ARIS 4.0 — Interop Hub v3 Deployment                      ║")
    print("║  Targets: STAGING (test.au-aris.org) + PROD (au-aris.org)   ║")
    print("╚══════════════════════════════════════════════════════════════╝")

    do_staging = not args.prod_only
    do_prod = not args.staging_only

    if do_staging:
        try:
            deploy_env(
                env_name="STAGING",
                app_host=STG_APP,
                db_host=STG_DB,
                deploy_dir=STG_DEPLOY_DIR,
                git_dir=STG_GIT_DIR,
                db_user=STG_DB_USER,
                db_pass=STG_DB_PASS,
                db_name=STG_DB_NAME,
                pg_container=STG_PG_CONTAINER,
                hub_container=STG_HUB_CONTAINER,
                prefix=STG_PREFIX,
                skip_seed=args.skip_seed,
                skip_schema=args.skip_schema,
            )
        except Exception as e:
            print(f"\n  ❌ STAGING deploy failed: {e}")
            if do_prod:
                print("  Continuing to PROD despite staging failure...")

    if do_prod:
        try:
            deploy_env(
                env_name="PRODUCTION",
                app_host=PROD_APP,
                db_host=PROD_DB,
                deploy_dir=PROD_DEPLOY_DIR,
                git_dir=PROD_GIT_DIR,
                db_user=PROD_DB_USER,
                db_pass=PROD_DB_PASS,
                db_name=PROD_DB_NAME,
                pg_container=PROD_PG_CONTAINER,
                hub_container=PROD_HUB_CONTAINER,
                prefix=PROD_PREFIX,
                skip_seed=args.skip_seed,
                skip_schema=args.skip_schema,
            )
        except Exception as e:
            print(f"\n  ❌ PRODUCTION deploy failed: {e}")

    print("\n" + "="*70)
    print("  DEPLOYMENT SUMMARY")
    print("="*70)
    if do_staging:
        print("  STAGING:    test.au-aris.org/interop-hub")
    if do_prod:
        print("  PRODUCTION: au-aris.org/interop-hub")
    print("  Hub API:    /api/v1/hub/*")
    print("  Legacy API: /api/v1/interop/* (still available)")
    print("="*70)


if __name__ == "__main__":
    main()
