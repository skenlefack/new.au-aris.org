#!/usr/bin/env python3
"""
ARIS 4.0 -- Deploy chantiers A-D to staging.

Phases:
  1. Git pull on VM-APP staging
  2. Copy docker-compose.yml to deploy dir
  3. Prisma db push (create/update tables)
  4. Seeds: indicator-types, dashboard-templates, report-templates
  5. Rebuild services: analytics, form-builder, collecte, credential, governance, web
  6. Healthcheck each rebuilt service

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  python -u _deploy_chantiers_ad_staging.py

  # Skip schema push:
  python -u _deploy_chantiers_ad_staging.py --skip-schema

  # Skip seeds:
  python -u _deploy_chantiers_ad_staging.py --skip-seeds

  # Rebuild only specific services:
  python -u _deploy_chantiers_ad_staging.py --only web analytics
"""
import sys
import os
import time
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import step, VM_PASS, VM_USER, get_client

import paramiko

# ── Staging config ──────────────────────────────────────────────
STG_APP = "10.202.101.146"
STG_DB_URL = "postgresql://aris:Ar1s_Stg_2024!xK9mZ@10.202.101.148:5432/aris"
DEPLOY_DIR = "/opt/aris-deploy/vm-app-stg"
COMPOSE_SRC = "deploy/vm-app-stg/docker-compose.yml"

# Services to rebuild (order matters: backends first, web last)
SERVICES_TO_REBUILD = [
    "analytics",
    "form-builder",
    "collecte",
    "credential",
    "governance",
    "web",
]

# Seeds to run (via npx tsx in container)
SEEDS = [
    ("indicator-types",      "aris-stg-analytics",  "seed-indicator-types.ts"),
    ("dashboard-templates",  "aris-stg-analytics",  "seed-dashboard-templates.ts"),
    ("report-templates",     "aris-stg-analytics",  "seed-report-templates.ts"),
]

# Container used for prisma db push
SCHEMA_CONTAINER = "aris-stg-analytics"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def run_sudo(client, cmd, timeout=120):
    """Execute a sudo command and return (exit_code, stdout, stderr)."""
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    # Filter sudo password prompts
    err = "\n".join(
        l for l in err.splitlines()
        if "[sudo]" not in l and "password" not in l.lower()
    )
    return code, out, err


def run_sudo_stream(client, cmd, timeout=300):
    """Execute a sudo command and stream output line by line."""
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
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
    err = "\n".join(
        l for l in err.splitlines()
        if "[sudo]" not in l and "password" not in l.lower()
    )
    return code, err


def connect():
    """Create SSH client to staging VM-APP."""
    return get_client(STG_APP)


# ── CLI args ──
parser = argparse.ArgumentParser(description="Deploy chantiers A-D to staging")
parser.add_argument("--skip-schema", action="store_true", help="Skip Prisma db push")
parser.add_argument("--skip-seeds", action="store_true", help="Skip seed scripts")
parser.add_argument(
    "--only", nargs="+",
    help="Rebuild only specific services (e.g. --only web analytics)",
)
args = parser.parse_args()

# ── Determine services to rebuild ──
services = SERVICES_TO_REBUILD
if args.only:
    services = [s for s in SERVICES_TO_REBUILD if s in args.only]
    if not services:
        safe_print(f"ERROR: None of {args.only} found in {SERVICES_TO_REBUILD}")
        sys.exit(1)

safe_print("=" * 60)
safe_print("  ARIS 4.0 -- Chantiers A-D Staging Deployment")
safe_print(f"  Target VM:  {STG_APP}")
safe_print(f"  Deploy dir: {DEPLOY_DIR}")
safe_print(f"  Services:   {', '.join(services)}")
safe_print("=" * 60)

results = {}

# ══════════════════════════════════════════════════════════════
# Phase 1: Git pull
# ══════════════════════════════════════════════════════════════
step("Phase 1: Git pull on /opt/aris")
c = connect()
code, out, err = run_sudo(c, "bash -c 'cd /opt/aris && git fetch origin && git reset --hard origin/main'", timeout=120)
c.close()
if code != 0:
    safe_print(f"  WARNING: git pull exit code {code}")
    if err:
        safe_print(f"  {err[:500]}")
else:
    safe_print(f"  {out[-200:] if out else 'OK'}")
results["git-pull"] = code == 0

# ══════════════════════════════════════════════════════════════
# Phase 2: Copy docker-compose.yml
# ══════════════════════════════════════════════════════════════
step("Phase 2: Copy docker-compose.yml to deploy dir")
c = connect()
# Backup existing compose file
ts = int(time.time())
code_bak, _, _ = run_sudo(
    c,
    f"bash -c 'cp {DEPLOY_DIR}/docker-compose.yml {DEPLOY_DIR}/docker-compose.yml.bak.{ts} 2>/dev/null || true'",
)
# Copy new compose file
code, out, err = run_sudo(
    c,
    f"bash -c 'cp /opt/aris/{COMPOSE_SRC} {DEPLOY_DIR}/docker-compose.yml'",
)
c.close()
if code != 0:
    safe_print(f"  ERROR: copy failed -- {err[:300]}")
    safe_print("  ABORTING: Cannot continue without updated compose file.")
    sys.exit(1)
safe_print(f"  Copied successfully (backup: docker-compose.yml.bak.{ts})")
results["compose-copy"] = True

# ══════════════════════════════════════════════════════════════
# Phase 3: Prisma db push
# ══════════════════════════════════════════════════════════════
if not args.skip_schema:
    step("Phase 3: Prisma db push (sync schema)")
    c = connect()

    # First check that the schema container is running
    code, out, err = run_sudo(
        c,
        f"bash -c 'docker ps --filter name={SCHEMA_CONTAINER} --format \"{{{{.Names}}}}\"'",
    )
    if SCHEMA_CONTAINER not in out:
        safe_print(f"  WARNING: {SCHEMA_CONTAINER} not running, trying aris-stg-credential...")
        SCHEMA_CONTAINER_ACTUAL = "aris-stg-credential"
    else:
        SCHEMA_CONTAINER_ACTUAL = SCHEMA_CONTAINER

    cmd = (
        f"bash -c 'docker exec -e DATABASE_URL=\"{STG_DB_URL}\" {SCHEMA_CONTAINER_ACTUAL} "
        f"sh -c \"cd /app/packages/db-schemas && npx prisma db push --schema=prisma --accept-data-loss 2>&1\"'"
    )
    code, err = run_sudo_stream(c, cmd, timeout=180)
    c.close()
    status = "OK" if code == 0 else f"FAILED ({code})"
    safe_print(f"  Schema push: {status}")
    if code != 0:
        safe_print(f"  Error: {err[:500]}")
        safe_print("  ABORTING: Schema push failed.")
        sys.exit(1)
    results["schema-push"] = True
else:
    safe_print("\n  (Skipping schema push -- --skip-schema)")
    results["schema-push"] = "SKIPPED"

# ══════════════════════════════════════════════════════════════
# Phase 4: Seeds
# ══════════════════════════════════════════════════════════════
if not args.skip_seeds:
    step("Phase 4: Run seed scripts")

    # Upload latest seed files from local repo
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    seed_dir = os.path.join(repo_root, "packages", "db-schemas", "prisma")

    seed_filenames = [s[2] for s in SEEDS]
    safe_print(f"  Uploading {len(seed_filenames)} seed files...")

    c = connect()
    sftp = c.open_sftp()
    for f in seed_filenames:
        local_path = os.path.join(seed_dir, f)
        if os.path.exists(local_path):
            sftp.put(local_path, f"/tmp/aris-{f}")
            safe_print(f"    Uploaded: {f}")
        else:
            safe_print(f"    WARN: {f} not found locally at {local_path}")
    sftp.close()
    c.close()

    # Copy to /opt/aris on the server
    c = connect()
    for f in seed_filenames:
        run_sudo(
            c,
            f"bash -c 'cp /tmp/aris-{f} /opt/aris/packages/db-schemas/prisma/{f} && rm -f /tmp/aris-{f}'",
        )
    c.close()
    safe_print("  Seed files updated on staging VM")

    # Determine which container to use for seeds
    c = connect()
    code, out, _ = run_sudo(
        c,
        f"bash -c 'docker ps --filter name=aris-stg-analytics --format \"{{{{.Names}}}}\"'",
    )
    c.close()
    seed_container = "aris-stg-analytics" if "aris-stg-analytics" in out else "aris-stg-credential"

    for i, (name, _container, script) in enumerate(SEEDS, 1):
        safe_print(f"\n  [{i}/{len(SEEDS)}] Seeding {name} via {seed_container}...")
        c = connect()
        cmd = (
            f"bash -c 'docker exec -e DATABASE_URL=\"{STG_DB_URL}\" {seed_container} "
            f"sh -c \"cd /app/packages/db-schemas && npx tsx prisma/{script} 2>&1\"'"
        )
        code, err = run_sudo_stream(c, cmd, timeout=180)
        c.close()
        status = "OK" if code == 0 else f"FAILED ({code})"
        safe_print(f"  {name}: {status}")
        if code != 0 and err:
            safe_print(f"  Error: {err[:500]}")
        results[f"seed-{name}"] = code == 0
else:
    safe_print("\n  (Skipping seeds -- --skip-seeds)")

# ══════════════════════════════════════════════════════════════
# Phase 5: Rebuild services
# ══════════════════════════════════════════════════════════════
step(f"Phase 5: Rebuild services ({', '.join(services)})")

for i, svc in enumerate(services, 1):
    safe_print(f"\n  [{i}/{len(services)}] Rebuilding {svc}...")
    c = connect()
    cmd = (
        f"bash -c 'cd {DEPLOY_DIR} && "
        f"docker compose up -d --build --no-deps {svc} 2>&1'"
    )
    code, err = run_sudo_stream(c, cmd, timeout=600)
    c.close()

    if code != 0:
        safe_print(f"  ERROR: {svc} rebuild failed (exit {code})")
        if err:
            safe_print(f"  {err[:500]}")
        results[f"rebuild-{svc}"] = False
        continue

    # Wait for container to stabilize
    safe_print(f"  Waiting 10s for {svc} to start...")
    time.sleep(10)

    # Healthcheck: verify container is Up
    c = connect()
    container_name = f"aris-stg-{svc}"
    code, out, _ = run_sudo(
        c,
        f"bash -c 'docker ps --filter name={container_name} --format \"{{{{.Status}}}}\"'",
    )
    c.close()

    if "Up" in out:
        safe_print(f"  {svc}: container Up")
        results[f"rebuild-{svc}"] = True
    else:
        safe_print(f"  WARNING: {svc} container status: {out or 'NOT FOUND'}")
        # Check logs for errors
        c = connect()
        code, out, _ = run_sudo(
            c,
            f"bash -c 'docker logs --tail 20 {container_name} 2>&1'",
        )
        c.close()
        safe_print(f"  Last logs:\n{out[:500]}")
        results[f"rebuild-{svc}"] = False

# ══════════════════════════════════════════════════════════════
# Phase 6: Final healthcheck
# ══════════════════════════════════════════════════════════════
step("Phase 6: Final healthcheck")

# Check all rebuilt containers
c = connect()
code, out, _ = run_sudo(c, "bash -c 'docker ps --filter name=aris-stg --format \"{{{{.Names}}}}  {{{{.Status}}}}\"'")
c.close()
safe_print("  Running containers:")
for line in out.splitlines():
    if any(svc in line for svc in services):
        safe_print(f"    {line}")

# Test web is accessible
c = connect()
code, out, _ = run_sudo(
    c,
    "bash -c 'curl -sf -o /dev/null -w \"%{http_code}\" http://localhost:3000/ 2>&1 || echo FAIL'",
    timeout=15,
)
c.close()
web_ok = out.strip() in ("200", "302", "301")
safe_print(f"  Web (localhost:3000): {'OK' if web_ok else out.strip()}")
results["web-healthcheck"] = web_ok

# Test credential login endpoint
c = connect()
login_cmd = (
    "curl -sf -o /dev/null -w '%{http_code}' "
    "-X POST http://localhost:3002/api/v1/credential/auth/login "
    "-H 'Content-Type: application/json' "
    "-d '{\"email\":\"admin@au-aris.org\",\"password\":\"Aris2026@@4!0\"}' "
    "2>&1 || echo FAIL"
)
code, out, _ = run_sudo(c, f"bash -c '{login_cmd}'", timeout=15)
c.close()
cred_ok = out.strip() in ("200", "201")
safe_print(f"  Credential login: {'OK' if cred_ok else out.strip()}")
results["credential-healthcheck"] = cred_ok

# ══════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════
safe_print(f"\n{'='*60}")
safe_print("  DEPLOYMENT SUMMARY")
safe_print(f"{'='*60}")

all_ok = True
for key, val in results.items():
    if val == "SKIPPED":
        status = "SKIPPED"
    elif val:
        status = "OK"
    else:
        status = "FAILED"
        all_ok = False
    safe_print(f"  {key:30s} {status}")

safe_print(f"{'='*60}")
if all_ok:
    safe_print("  All phases completed successfully.")
    safe_print("  URL: https://test.au-aris.org/")
else:
    safe_print("  Some phases failed. Check output above.")
safe_print(f"{'='*60}")

sys.exit(0 if all_ok else 1)
