#!/usr/bin/env python3
"""
ARIS 4.0 — Seed staging database in correct dependency order.

Based on production reseed-ordered.py but adapted for staging:
  - Container names: aris-stg-* instead of aris-*
  - DATABASE_URL points to staging DB (10.202.101.148)
  - Uploads latest seed files from local repo before running

Order:
  1. Prisma db push (schema sync)
  2. settings    (countries, RECs, domains, admin levels)
  3. credential  (users — needs tenants/settings)
  4. functions   (functions + user_functions — needs users)
  5. master-data (reference data)
  6. workflow    (needs settings/countries + users)
  7. bi          (needs users, UUID cast fixed)

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  python -u _seed_stg.py

  # Skip schema push, seed only:
  python -u _seed_stg.py --skip-schema

  # Run specific seeds only:
  python -u _seed_stg.py --only settings credential
"""
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import step, VM_PASS, VM_USER

import paramiko

STG_APP = "10.202.101.146"
STG_DB_URL = "postgresql://aris:Ar1s_Stg_2024!xK9mZ@10.202.101.148:5432/aris"

# Seed order — tenant FIRST (creates AU-IBAR, RECs, Member State tenants)
SEEDS = [
    ("tenant",      "aris-stg-tenant",     "seed-tenant.ts"),
    ("settings",    "aris-stg-tenant",     "seed-settings.ts"),
    ("credential",  "aris-stg-credential", "seed-credential.ts"),
    ("functions",   "aris-stg-credential", "seed-functions.ts"),
    ("master-data", "aris-stg-credential", "seed-master-data.ts"),
    ("workflow",    "aris-stg-workflow",    "seed-workflow.ts"),
    ("bi",            "aris-stg-credential",    "seed-bi.ts"),
    ("knowledge-hub", "aris-stg-knowledge-hub", "seed-knowledge-hub.ts"),
]


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(STG_APP, port=22, username=VM_USER, password=VM_PASS,
              timeout=15, allow_agent=False, look_for_keys=False)
    return c


def run_sudo(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, out, err


def run_sudo_stream(client, cmd, timeout=300):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        if line:
            safe_print(f"  {line}")
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, err


# ── CLI args ──
parser = argparse.ArgumentParser()
parser.add_argument("--skip-schema", action="store_true", help="Skip Prisma db push")
parser.add_argument("--only", nargs="+", help="Run only specific seeds (e.g. --only settings credential)")
args = parser.parse_args()

safe_print("=" * 60)
safe_print("  ARIS 4.0 — Staging Database Seed")
safe_print(f"  Target: {STG_APP}")
safe_print(f"  DB:     {STG_DB_URL.split('@')[1]}")
safe_print("=" * 60)

# ── Step 0: Upload latest seed files from local repo ──
step("Step 0: Upload latest seed files to staging VM")
repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
seed_dir = os.path.join(repo_root, "packages", "db-schemas", "prisma")

seed_files = [f for f in os.listdir(seed_dir) if f.startswith("seed-") and f.endswith(".ts")]
safe_print(f"  Found {len(seed_files)} seed files locally")

c = get_client()
sftp = c.open_sftp()
for f in seed_files:
    local_path = os.path.join(seed_dir, f)
    remote_tmp = f"/tmp/aris-{f}"
    sftp.put(local_path, remote_tmp)
    safe_print(f"  Uploaded: {f}")
sftp.close()
c.close()

# Move files into the credential container's packages dir (via host /opt/aris)
c = get_client()
for f in seed_files:
    remote_tmp = f"/tmp/aris-{f}"
    dest = f"/opt/aris/packages/db-schemas/prisma/{f}"
    code, out, err = run_sudo(c, f"bash -c 'cp {remote_tmp} {dest} && rm -f {remote_tmp}'")
    if code != 0:
        safe_print(f"  WARN: Could not copy {f}: {err[:200]}")
safe_print("  Seed files updated on staging VM")
c.close()

# ── Step 1: Prisma db push ──
if not args.skip_schema:
    step("Step 1: Prisma db push (sync schema to database)")
    c = get_client()
    cmd = f"""bash -c 'docker exec -e DATABASE_URL="{STG_DB_URL}" aris-stg-credential sh -c "cd /app/packages/db-schemas && npx prisma db push --schema=prisma --accept-data-loss 2>&1"'"""
    code, err = run_sudo_stream(c, cmd, timeout=120)
    status = "OK" if code == 0 else f"FAILED ({code})"
    safe_print(f"  Schema push: {status}")
    if err and code != 0:
        safe_print(f"  Error: {err[:500]}")
        safe_print("\n  ABORTING: Schema push failed. Fix the issue and retry.")
        c.close()
        sys.exit(1)
    c.close()
else:
    safe_print("\n  (Skipping schema push — --skip-schema)")

# ── Step 2: Run seeds in order ──
seeds_to_run = SEEDS
if args.only:
    seeds_to_run = [(n, ct, s) for n, ct, s in SEEDS if n in args.only]
    safe_print(f"\n  Running only: {', '.join(args.only)}")

for i, (name, container, script) in enumerate(seeds_to_run, 1):
    step(f"Step 2.{i}: Seed {name} (via {container})")

    # Verify container is running
    c = get_client()
    code, out, err = run_sudo(c, f"bash -c 'docker ps --filter name={container} --format \"{{{{.Names}}}}\" 2>&1'")
    c.close()

    if container not in out:
        safe_print(f"  SKIP: Container {container} not running")
        safe_print(f"  docker ps output: {out[:200]}")
        continue

    # Run seed
    c = get_client()
    cmd = f"""bash -c 'docker exec -e DATABASE_URL="{STG_DB_URL}" {container} sh -c "cd /app/packages/db-schemas && npx tsx prisma/{script} 2>&1"'"""
    code, err = run_sudo_stream(c, cmd, timeout=180)
    status = "OK" if code == 0 else f"FAILED ({code})"
    safe_print(f"  {name}: {status}")
    if err and code != 0:
        safe_print(f"  Error: {err[:500]}")
    c.close()

# ── Step 3: Verify login ──
step("Step 3: Verify login")
c = get_client()
login_cmd = """curl -sf -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}' 2>&1 | head -c 500"""
code, out, err = run_sudo(c, f"bash -c '{login_cmd}'", timeout=15)
safe_print(f"  Login response: {out[:500] if out else 'NO RESPONSE'}")
c.close()

safe_print("\n" + "=" * 60)
safe_print("  STAGING SEED COMPLETE!")
safe_print("  Login: admin@au-aris.org / Aris2024!")
safe_print("  URL:   https://test.au-aris.org/")
safe_print("=" * 60)
