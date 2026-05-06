#!/usr/bin/env python3
"""
ARIS 4.0 -- Seed CAADP & ARIS KPI indicators on staging and/or production.

Steps:
  1. Git pull on target VM
  2. Upload seed-caadp-indicators.ts to the server
  3. Run the seed via npx tsx in an analytics container

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'

  # Staging (default)
  python -u _seed_caadp_indicators.py

  # Production
  python -u _seed_caadp_indicators.py --env prod

  # Both
  python -u _seed_caadp_indicators.py --env both
"""
import sys
import os
import time
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import step, VM_PASS, VM_USER, get_client

ENVS = {
    "staging": {
        "name": "STAGING",
        "vm_app": "10.202.101.146",
        "db_url": "postgresql://aris:Ar1s_Stg_2024!xK9mZ@10.202.101.148:5432/aris",
        "container": "aris-stg-analytics",
        "fallback_container": "aris-stg-credential",
    },
    "prod": {
        "name": "PRODUCTION",
        "vm_app": "10.202.101.183",
        "db_url": "postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris",
        "container": "aris-analytics",
        "fallback_container": "aris-credential",
    },
}

SEED_FILE = "seed-caadp-indicators.ts"
REMOTE_SEED_DIR = "/opt/aris/packages/db-schemas/prisma"


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


def deploy_to_env(env_key):
    env = ENVS[env_key]
    safe_print("")
    safe_print("=" * 60)
    safe_print(f"  Seeding CAADP indicators on {env['name']}")
    safe_print(f"  VM: {env['vm_app']}")
    safe_print("=" * 60)

    # ── Phase 1: Git pull ──
    step(f"Phase 1: Git pull on {env['name']}")
    c = get_client(env["vm_app"])
    code, out, err = run_sudo(
        c,
        "bash -c 'cd /opt/aris && git fetch origin && git reset --hard origin/main'",
        timeout=120,
    )
    c.close()
    if code != 0:
        safe_print(f"  WARNING: git pull exit code {code}")
        if err:
            safe_print(f"  {err[:500]}")
    else:
        # Show last line of git output
        last_line = out.strip().split("\n")[-1] if out else "OK"
        safe_print(f"  {last_line}")

    # ── Phase 2: Upload seed file ──
    step("Phase 2: Upload seed file")
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    local_seed = os.path.join(repo_root, "packages", "db-schemas", "prisma", SEED_FILE)

    if not os.path.exists(local_seed):
        safe_print(f"  ERROR: {local_seed} not found locally")
        return False

    c = get_client(env["vm_app"])
    sftp = c.open_sftp()
    sftp.put(local_seed, f"/tmp/aris-{SEED_FILE}")
    sftp.close()
    safe_print(f"  Uploaded {SEED_FILE} to /tmp/")

    # Copy to /opt/aris (host) AND to container
    run_sudo(
        c,
        f"bash -c 'cp /tmp/aris-{SEED_FILE} {REMOTE_SEED_DIR}/{SEED_FILE}'",
    )
    run_sudo(
        c,
        f"bash -c 'rm -f /tmp/aris-{SEED_FILE}'",
    )
    c.close()
    safe_print(f"  Copied to {REMOTE_SEED_DIR}/{SEED_FILE} (host)")

    # ── Phase 3: Determine container ──
    step("Phase 3: Find running container")
    c = get_client(env["vm_app"])
    code, out, _ = run_sudo(
        c,
        f"bash -c 'docker ps --filter name={env['container']} --format \"{{{{.Names}}}}\"'",
    )
    c.close()

    container = env["container"]
    if container not in (out or ""):
        safe_print(f"  {container} not running, trying {env['fallback_container']}...")
        container = env["fallback_container"]
    safe_print(f"  Using container: {container}")

    # ── Phase 3b: Copy seed file INTO container ──
    step("Phase 3b: Copy seed file into container")
    c = get_client(env["vm_app"])
    copy_cmd = (
        f"bash -c 'docker cp {REMOTE_SEED_DIR}/{SEED_FILE} "
        f"{container}:/app/packages/db-schemas/prisma/{SEED_FILE}'"
    )
    code, out, err = run_sudo(c, copy_cmd, timeout=30)
    c.close()
    if code != 0:
        safe_print(f"  ERROR: docker cp failed — {err[:300]}")
        return False
    safe_print(f"  Copied into {container}:/app/packages/db-schemas/prisma/")

    # ── Phase 4: Run seed ──
    step("Phase 4: Run seed-caadp-indicators.ts")
    c = get_client(env["vm_app"])
    cmd = (
        f"bash -c 'docker exec -e DATABASE_URL=\"{env['db_url']}\" {container} "
        f"sh -c \"cd /app/packages/db-schemas && npx tsx prisma/{SEED_FILE} 2>&1\"'"
    )
    code, err = run_sudo_stream(c, cmd, timeout=180)
    c.close()

    if code != 0:
        safe_print(f"\n  SEED FAILED (exit {code})")
        if err:
            safe_print(f"  Error: {err[:500]}")
        return False

    safe_print(f"\n  SEED OK on {env['name']}")

    # ── Phase 5: Verify ──
    step("Phase 5: Verify indicators in DB")
    c = get_client(env["vm_app"])
    pg_container = "aris-stg-postgres" if env_key == "staging" else "aris-postgres"
    verify_cmd = (
        f"bash -c 'docker exec {pg_container} "
        f"psql -U aris -d aris -c \""
        f"SELECT type_code, count(*) as cnt FROM analytics.indicators WHERE active = true GROUP BY type_code ORDER BY type_code;"
        f"\" 2>&1'"
    )
    code, out, _ = run_sudo(c, verify_cmd, timeout=30)
    c.close()

    if code == 0 and out:
        safe_print(f"\n  Indicators in DB:")
        for line in out.strip().split("\n"):
            safe_print(f"    {line}")

    return True


# ── CLI ──
parser = argparse.ArgumentParser(description="Seed CAADP indicators")
parser.add_argument(
    "--env",
    choices=["staging", "prod", "both"],
    default="staging",
    help="Target environment (default: staging)",
)
args = parser.parse_args()

safe_print("=" * 60)
safe_print("  ARIS 4.0 -- CAADP & KPI Indicator Seed")
safe_print(f"  Target: {args.env.upper()}")
safe_print("=" * 60)

targets = ["staging", "prod"] if args.env == "both" else [args.env]
results = {}

for target in targets:
    results[target] = deploy_to_env(target)

# ── Summary ──
safe_print("\n" + "=" * 60)
safe_print("  SUMMARY")
safe_print("=" * 60)
for target, ok in results.items():
    status = "OK" if ok else "FAILED"
    safe_print(f"  {target.upper()}: {status}")
safe_print("")

if not all(results.values()):
    sys.exit(1)
