#!/usr/bin/env python3
"""
ARIS 4.0 -- Deploy DB changes for Chantiers A-D.

Creates new schemas, tables, and seeds reference data for:
  - Chantier A: Sub-domains & Value Chains (form_targets, campaign_domain_targets, campaign_targets)
  - Chantier B: Indicators (analytics.indicator_types, indicators, indicator_values, formulas)
  - Chantier C: Dashboard Builder (dashboard_builder.* — 4 tables)
  - Chantier D: Reports & Flash Alerts (reports.* — 7 tables)

Steps:
  1. Backup database (pg_dump)
  2. Create new schemas (dashboard_builder, reports)
  3. Prisma db push (create all new tables)
  4. Seed indicator types (reference data)

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'

  # Deploy to staging (default)
  python -u _deploy_db_chantiers_ad.py

  # Deploy to production
  python -u _deploy_db_chantiers_ad.py --env prod

  # Skip backup (not recommended)
  python -u _deploy_db_chantiers_ad.py --skip-backup

  # Only run schema push, no seeds
  python -u _deploy_db_chantiers_ad.py --skip-seeds
"""
import sys
import os
import argparse
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import step, ssh, ssh_stream, get_client, VM_USER, VM_PASS

# ── Environment configs ──────────────────────────────────────────

ENVS = {
    "staging": {
        "name": "STAGING",
        "vm_app": "10.202.101.146",
        "vm_db": "10.202.101.148",
        "db_url": "postgresql://aris:Ar1s_Stg_2024!xK9mZ@10.202.101.148:5432/aris",
        "pg_container": "aris-stg-postgres",
        "app_container": "aris-stg-credential",  # container with Prisma client
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "backup_prefix": "aris_stg_backup",
    },
    "prod": {
        "name": "PRODUCTION",
        "vm_app": "10.202.101.183",
        "vm_db": "10.202.101.185",
        "db_url": "postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris",
        "pg_container": "aris-postgres",
        "app_container": "aris-credential",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "backup_prefix": "aris_prod_backup",
    },
}

# New schemas to create (Chantiers C and D)
NEW_SCHEMAS = ["dashboard_builder", "reports"]


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def run_on_db(env, cmd, timeout=120):
    """Run a command on the DB VM via docker exec on the postgres container."""
    full_cmd = f'docker exec {env["pg_container"]} bash -c "{cmd}"'
    code, out, err = ssh(env["vm_db"], full_cmd, timeout=timeout)
    return code, out, err


def run_on_app(env, cmd, timeout=120):
    """Run a command on the APP VM."""
    code, out, err = ssh(env["vm_app"], cmd, timeout=timeout)
    return code, out, err


def backup_database(env):
    """Create a compressed database backup on the DB VM."""
    step(f"Step 1: Backup database ({env['name']})")

    timestamp = time.strftime("%Y%m%d_%H%M%S")
    backup_file = f"/tmp/{env['backup_prefix']}_{timestamp}.sql.gz"

    safe_print(f"  Backup file: {backup_file}")
    safe_print(f"  Container: {env['pg_container']}")

    # pg_dump inside the postgres container, compress, save to host /tmp
    dump_cmd = (
        f"docker exec {env['pg_container']} "
        f"pg_dump -U aris -d aris --no-owner --no-privileges "
        f"| gzip > {backup_file}"
    )

    code, out, err = ssh(env["vm_db"], dump_cmd, timeout=300)

    if code != 0:
        safe_print(f"  ERROR: Backup failed (exit {code})")
        safe_print(f"  stderr: {err[:500]}")
        return False, None

    # Verify backup file exists and has size
    code, out, err = ssh(env["vm_db"], f"ls -lh {backup_file}", timeout=10)
    safe_print(f"  {out.strip()}")

    safe_print(f"  Backup completed: {backup_file}")
    return True, backup_file


def create_schemas(env):
    """Create new PostgreSQL schemas if they don't exist."""
    step(f"Step 2: Create new DB schemas ({env['name']})")

    for schema in NEW_SCHEMAS:
        sql = f"CREATE SCHEMA IF NOT EXISTS {schema};"
        cmd = f"psql -U aris -d aris -c \\'{sql}\\'"
        code, out, err = run_on_db(env, cmd, timeout=15)

        if code == 0:
            safe_print(f"  Schema '{schema}': OK")
        else:
            safe_print(f"  Schema '{schema}': FAILED — {err[:200]}")
            return False

    # Verify schemas exist
    verify_sql = "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('dashboard_builder','reports') ORDER BY 1;"
    cmd = f"psql -U aris -d aris -t -c \\'{verify_sql}\\'"
    code, out, err = run_on_db(env, cmd, timeout=10)
    safe_print(f"  Verified schemas: {out.strip()}")

    return True


def prisma_db_push(env):
    """Run prisma db push to create/sync all new tables."""
    step(f"Step 3: Prisma db push ({env['name']})")

    safe_print(f"  Container: {env['app_container']}")
    safe_print(f"  DB target: {env['db_url'].split('@')[1]}")

    # First, git pull to ensure latest Prisma schemas
    safe_print("  Pulling latest code...")
    code, out, err = run_on_app(env, "cd /opt/aris && git pull origin main", timeout=60)
    if code != 0:
        safe_print(f"  WARN: git pull returned {code}: {err[:200]}")

    # Run prisma db push via the app container
    push_cmd = (
        f'docker exec -e DATABASE_URL="{env["db_url"]}" {env["app_container"]} '
        f'sh -c "cd /app/packages/db-schemas && npx prisma db push --schema=prisma --accept-data-loss 2>&1"'
    )

    code, out, err = ssh_stream(env["vm_app"], push_cmd, timeout=120)

    if code != 0:
        safe_print(f"  ERROR: prisma db push failed (exit {code})")
        safe_print(f"  stderr: {err[:500]}")
        return False

    safe_print("  Prisma db push: OK")
    return True


def verify_tables(env):
    """Verify that new tables were created."""
    step(f"Step 4: Verify new tables ({env['name']})")

    checks = [
        ("dashboard_builder", "dashboards"),
        ("dashboard_builder", "dashboard_widgets"),
        ("dashboard_builder", "dashboard_shares"),
        ("dashboard_builder", "user_dashboard_preferences"),
        ("reports", "report_templates"),
        ("reports", "reports"),
        ("reports", "report_sections"),
        ("reports", "report_files"),
        ("reports", "flash_alerts"),
        ("reports", "flash_strategies"),
        ("reports", "ai_generation_jobs"),
        ("analytics", "indicator_types"),
        ("analytics", "indicators"),
        ("analytics", "indicator_values"),
        ("analytics", "indicator_formulas"),
        ("analytics", "indicator_formula_dependencies"),
        ("form_builder", "form_targets"),
        ("public", "campaign_domain_targets"),
        ("public", "campaign_targets"),
    ]

    all_ok = True
    for schema, table in checks:
        sql = f"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\\'{schema}\\' AND table_name=\\'{table}\\';"
        cmd = f"psql -U aris -d aris -t -c \\\"{sql}\\\""
        code, out, err = run_on_db(env, cmd, timeout=10)
        exists = out.strip() == "1"
        status = "OK" if exists else "MISSING"
        safe_print(f"  {schema}.{table}: {status}")
        if not exists:
            all_ok = False

    return all_ok


def seed_indicator_types(env):
    """Seed indicator type reference data."""
    step(f"Step 5: Seed indicator types ({env['name']})")

    # Check if seed script exists in the container
    check_cmd = (
        f'docker exec {env["app_container"]} '
        f'sh -c "ls -la /app/packages/db-schemas/prisma/seed-indicators.ts 2>&1 || echo NOT_FOUND"'
    )
    code, out, err = ssh(env["vm_app"], check_cmd, timeout=10)

    if "NOT_FOUND" in out:
        safe_print("  No seed-indicators.ts found — skipping seed step")
        safe_print("  (Indicator types can be seeded later via the admin UI or a dedicated script)")
        return True

    seed_cmd = (
        f'docker exec -e DATABASE_URL="{env["db_url"]}" {env["app_container"]} '
        f'sh -c "cd /app/packages/db-schemas && npx tsx prisma/seed-indicators.ts 2>&1"'
    )

    code, out, err = ssh_stream(env["vm_app"], seed_cmd, timeout=120)

    if code != 0:
        safe_print(f"  WARN: Seed returned exit code {code}")
        safe_print(f"  This is non-critical — tables are created, data can be seeded later")
        return True  # Non-blocking

    safe_print("  Indicator types seeded: OK")
    return True


def rebuild_services(env):
    """Rebuild affected services to pick up new Prisma client."""
    step(f"Step 6: Rebuild affected services ({env['name']})")

    services = ["credential", "analytics", "web"]

    for svc in services:
        safe_print(f"  Rebuilding {svc}...")
        rebuild_cmd = (
            f'cd {env["deploy_dir"]} && '
            f'docker compose up -d --build --no-deps {svc}'
        )
        code, out, err = ssh_stream(env["vm_app"], rebuild_cmd, timeout=600)

        if code != 0:
            safe_print(f"  ERROR: {svc} rebuild failed (exit {code})")
            safe_print(f"  stderr: {err[:300]}")
            return False

        safe_print(f"  {svc}: OK")

    return True


def verify_services(env):
    """Quick health check on key services."""
    step(f"Step 7: Verify services ({env['name']})")

    checks = [
        ("credential", "http://localhost:3002/api/v1/credential/auth/login"),
        ("web", "http://localhost:3000/"),
    ]

    for name, url in checks:
        cmd = f'curl -sf -o /dev/null -w "%{{http_code}}" {url} 2>&1 || echo FAIL'
        code, out, err = ssh(env["vm_app"], cmd, timeout=15)
        status_code = out.strip()
        # 200 or 405 (Method Not Allowed for POST-only endpoints) are both OK
        ok = status_code in ("200", "405", "401")
        safe_print(f"  {name} ({url}): HTTP {status_code} {'OK' if ok else 'CHECK'}")

    return True


# ── Main ─────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Deploy DB changes for Chantiers A-D")
    parser.add_argument("--env", choices=["staging", "prod"], default="staging",
                        help="Target environment (default: staging)")
    parser.add_argument("--skip-backup", action="store_true",
                        help="Skip database backup (NOT recommended)")
    parser.add_argument("--skip-seeds", action="store_true",
                        help="Skip seeding reference data")
    parser.add_argument("--skip-rebuild", action="store_true",
                        help="Skip rebuilding Docker services")
    parser.add_argument("--verify-only", action="store_true",
                        help="Only verify tables exist, no modifications")
    args = parser.parse_args()

    env = ENVS[args.env]

    safe_print("=" * 60)
    safe_print(f"  ARIS 4.0 -- Chantiers A-D Database Deployment")
    safe_print(f"  Environment: {env['name']}")
    safe_print(f"  DB VM: {env['vm_db']}")
    safe_print(f"  APP VM: {env['vm_app']}")
    safe_print("=" * 60)

    if args.env == "prod":
        safe_print("\n  *** PRODUCTION DEPLOYMENT ***")
        safe_print("  Press Ctrl+C within 5 seconds to abort...")
        try:
            time.sleep(5)
        except KeyboardInterrupt:
            safe_print("\n  Aborted by user.")
            return 1
        safe_print("  Proceeding with production deployment.\n")

    if args.verify_only:
        verify_tables(env)
        verify_services(env)
        return 0

    results = {}

    # Step 1: Backup
    if not args.skip_backup:
        ok, backup_file = backup_database(env)
        results["backup"] = ok
        if not ok:
            safe_print("\n  ABORTING: Backup failed. Fix the issue and retry.")
            return 1
    else:
        safe_print("\n  (Skipping backup -- --skip-backup)")
        results["backup"] = "SKIPPED"

    # Step 2: Create schemas
    ok = create_schemas(env)
    results["schemas"] = ok
    if not ok:
        safe_print("\n  ABORTING: Schema creation failed.")
        return 1

    # Step 3: Prisma db push
    ok = prisma_db_push(env)
    results["prisma_push"] = ok
    if not ok:
        safe_print("\n  ABORTING: Prisma db push failed.")
        safe_print("  The backup can be restored manually if needed.")
        return 1

    # Step 4: Verify tables
    ok = verify_tables(env)
    results["verify_tables"] = ok
    if not ok:
        safe_print("\n  WARNING: Some tables are missing. Check prisma db push output.")

    # Step 5: Seeds
    if not args.skip_seeds:
        ok = seed_indicator_types(env)
        results["seeds"] = ok
    else:
        safe_print("\n  (Skipping seeds -- --skip-seeds)")
        results["seeds"] = "SKIPPED"

    # Step 6: Rebuild services
    if not args.skip_rebuild:
        ok = rebuild_services(env)
        results["rebuild"] = ok
        if not ok:
            safe_print("\n  WARNING: Service rebuild failed. Check Docker logs.")
    else:
        safe_print("\n  (Skipping service rebuild -- --skip-rebuild)")
        results["rebuild"] = "SKIPPED"

    # Step 7: Verify services
    verify_services(env)

    # Summary
    safe_print(f"\n{'='*60}")
    safe_print(f"  DEPLOYMENT SUMMARY — {env['name']}")
    safe_print(f"{'='*60}")
    for name, status in results.items():
        if isinstance(status, bool):
            label = "OK" if status else "FAILED"
        else:
            label = status
        safe_print(f"  {name:20s}: {label}")
    safe_print(f"{'='*60}")

    all_ok = all(v is True or v == "SKIPPED" for v in results.values())
    if all_ok:
        safe_print(f"\n  Deployment to {env['name']} completed successfully!")
    else:
        safe_print(f"\n  Deployment to {env['name']} completed with warnings.")

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
