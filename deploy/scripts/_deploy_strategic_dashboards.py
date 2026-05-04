#!/usr/bin/env python3
"""
Deploy strategic dashboards seed to PRODUCTION and STAGING.

Steps per environment:
1. SSH to VM-APP → git pull
2. Run seed-strategic-dashboards.ts via npx tsx (or node + compiled)
3. Report results

Usage:
    python deploy/scripts/_deploy_strategic_dashboards.py
    python deploy/scripts/_deploy_strategic_dashboards.py --env prod
    python deploy/scripts/_deploy_strategic_dashboards.py --env staging
"""

import paramiko
import time
import sys
import os
import argparse

# Fix Windows encoding
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# ── Connection details ──────────────────────────────────────────────────────

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = {
    "prod": {
        "label": "PRODUCTION",
        "vm_app": "10.202.101.183",
        "db_url": "postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:6432/aris?pgbouncer=true",
        "git_dir": "/opt/aris",
    },
    "staging": {
        "label": "STAGING",
        "vm_app": "10.202.101.146",
        "db_url": "postgresql://aris:Ar1s_Stg_2024!xK9mZ@10.202.101.148:6432/aris?pgbouncer=true",
        "git_dir": "/opt/aris",
    },
}

SUDO = "echo '@u-1baR.0rg$U24' | sudo -S"


def ssh_exec(ssh, cmd, timeout=120):
    """Execute command and return output."""
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    return exit_code, out, err


def deploy_env(env_key):
    """Deploy strategic dashboards to one environment."""
    env = ENVS[env_key]
    print(f"\n{'='*60}")
    print(f"  Deploying to {env['label']} ({env['vm_app']})")
    print(f"{'='*60}\n")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(env["vm_app"], username=SSH_USER, password=SSH_PASS, timeout=15)
        print(f"  [OK] Connected to {env['vm_app']}")
    except Exception as e:
        print(f"  [FAIL] Cannot connect: {e}")
        return False

    # Step 1: Git pull
    print("\n  [1/3] Git pull...")
    code, out, err = ssh_exec(ssh, f"{SUDO} bash -c 'cd {env['git_dir']} && git fetch origin && git reset --hard origin/main'")
    if code != 0:
        print(f"    FAILED: {err}")
        ssh.close()
        return False
    print(f"    OK: {out[-80:] if out else 'up to date'}")

    # Step 2: Install deps if needed (for tsx)
    print("\n  [2/3] Checking tsx availability...")
    code, out, err = ssh_exec(ssh, f"cd {env['git_dir']} && npx tsx --version 2>/dev/null || echo 'NOT_FOUND'")
    if "NOT_FOUND" in out or code != 0:
        print("    tsx not found, installing...")
        code, out, err = ssh_exec(ssh, f"{SUDO} bash -c 'cd {env['git_dir']} && npm install -g tsx'", timeout=60)
        if code != 0:
            # Fallback: use npx
            print("    Will use npx tsx (slower but works)")

    # Step 3: Run the seed
    print("\n  [3/3] Running seed-strategic-dashboards.ts...")
    # Use full path for node/npx to handle PATH issues on staging
    seed_cmd = (
        f"export PATH=/usr/local/bin:/usr/bin:/opt/aris/node_modules/.bin:$PATH && "
        f"cd {env['git_dir']} && "
        f"DATABASE_URL=\"{env['db_url']}\" "
        f"npx tsx packages/db-schemas/prisma/seed-strategic-dashboards.ts 2>&1"
    )
    code, out, err = ssh_exec(ssh, seed_cmd, timeout=180)

    if out:
        # Print output line by line with indent
        for line in out.split("\n"):
            print(f"    {line}")

    if code != 0:
        print(f"\n    [FAIL] Exit code: {code}")
        if err:
            print(f"    Stderr: {err[:500]}")
        ssh.close()
        return False

    print(f"\n  [OK] {env['label']} — Strategic dashboards seeded successfully!")
    ssh.close()
    return True


def main():
    parser = argparse.ArgumentParser(description="Deploy strategic dashboards")
    parser.add_argument("--env", choices=["prod", "staging", "both"], default="both",
                        help="Target environment (default: both)")
    args = parser.parse_args()

    targets = ["prod", "staging"] if args.env == "both" else [args.env]
    results = {}

    print("╔══════════════════════════════════════════════════════════╗")
    print("║   ARIS 4.0 — Strategic Dashboard Deployment             ║")
    print("║   29 Dashboards · 143 Sections · 343 Widgets            ║")
    print("╚══════════════════════════════════════════════════════════╝")

    for env_key in targets:
        results[env_key] = deploy_env(env_key)

    # Summary
    print(f"\n{'='*60}")
    print("  DEPLOYMENT SUMMARY")
    print(f"{'='*60}")
    for env_key, success in results.items():
        status = "✓ SUCCESS" if success else "✗ FAILED"
        print(f"  {ENVS[env_key]['label']:12s}: {status}")
    print()

    if not all(results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
