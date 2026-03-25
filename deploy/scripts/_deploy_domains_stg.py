#!/usr/bin/env python3
"""
Deploy domain integration to staging (test.au-aris.org)
96 files changed across 15 services — commit 7fc67c3

Steps:
  1. Git pull on /opt/aris
  2. Copy docker-compose.yml to deploy dir
  3. Rebuild credential service (Prisma schema + domain routes)
  4. Apply Prisma schema (db push for new Domain/UserDomain tables)
  5. Seed domains
  6. Rebuild web frontend
  7. Rebuild 8 business services (domainsHook)
  8. Rebuild 4 other services (analytics, collecte, form-builder, master-data)
  9. Health checks on all rebuilt services
"""
import paramiko
import sys
import time
import re

# ── Staging config ──────────────────────────────────────────────────
STG_APP = "10.202.101.146"
STG_DB  = "10.202.101.148"
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
DEPLOY_DIR = "/opt/aris-deploy/vm-app-stg"
GIT_DIR = "/opt/aris"
DB_PASS = "Ar1s_Stg_2024!xK9mZ"

# Services to rebuild, in order
CREDENTIAL = ["credential"]
WEB = ["web"]
BUSINESS_SERVICES = [
    "animal-health", "livestock-prod", "fisheries", "wildlife",
    "apiculture", "trade-sps", "governance", "climate-env",
]
OTHER_SERVICES = ["analytics", "collecte", "form-builder", "master-data"]

ALL_SERVICES = CREDENTIAL + WEB + BUSINESS_SERVICES + OTHER_SERVICES

# Health check endpoints
HEALTH_PORTS = {
    "credential": 3002,
    "web": 3100,
    "animal-health": 3020,
    "livestock-prod": 3021,
    "fisheries": 3022,
    "wildlife": 3023,
    "apiculture": 3024,
    "trade-sps": 3025,
    "governance": 3026,
    "climate-env": 3027,
    "analytics": 3030,
    "collecte": 3011,
    "form-builder": 3010,
    "master-data": 3003,
}


def connect(host):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)
    return ssh


def run_sudo(ssh, cmd, timeout=120):
    full = f"echo '{SSH_PASS}' | sudo -S bash -c '{cmd}'"
    stdin, stdout, stderr = ssh.exec_command(full, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    # Filter sudo noise
    err_lines = [l for l in err.splitlines()
                 if not re.match(r"^\[sudo\]|^$", l)]
    return out, "\n".join(err_lines)


def run_sudo_stream(ssh, cmd, timeout=600):
    """Stream output for long-running commands."""
    full = f"echo '{SSH_PASS}' | sudo -S bash -c '{cmd}'"
    stdin, stdout, stderr = ssh.exec_command(full, timeout=timeout)
    output_lines = []
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        if line:
            output_lines.append(line)
            # Show interesting lines
            low = line.lower()
            if any(k in low for k in ["error", "built", "running", "created",
                                       "started", "pulling", "building",
                                       "done", "fail", "warning", "seed"]):
                print(f"    {line}")
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err_lines = [l for l in err.splitlines()
                 if not re.match(r"^\[sudo\]|^$", l)]
    return "\n".join(output_lines), "\n".join(err_lines)


def step(num, total, msg):
    print(f"\n{'='*60}")
    print(f"  [{num}/{total}] {msg}")
    print(f"{'='*60}")


def main():
    total_steps = 9
    ssh = None
    try:
        # ── Step 1: Connect ──────────────────────────────────────
        step(1, total_steps, "Connecting to staging APP VM")
        ssh = connect(STG_APP)
        print(f"  Connected to {STG_APP}")

        # ── Step 2: Git pull ─────────────────────────────────────
        step(2, total_steps, "Git pull on /opt/aris")
        out, err = run_sudo(ssh, f"cd {GIT_DIR} && git pull origin main")
        for line in out.splitlines():
            if any(k in line.lower() for k in ["updating", "file", "changed",
                                                 "already", "fast-forward"]):
                print(f"    {line}")
        if "error" in (out + err).lower():
            print(f"  WARNING: {err}")

        # ── Step 3: Copy docker-compose ──────────────────────────
        step(3, total_steps, "Copy docker-compose.yml to deploy dir")
        out, err = run_sudo(
            ssh,
            f"cp {GIT_DIR}/deploy/vm-app/docker-compose.yml {DEPLOY_DIR}/docker-compose.yml"
        )
        if err:
            print(f"  WARNING: {err}")
        else:
            print("  docker-compose.yml copied")

        # ── Step 4: Rebuild credential ───────────────────────────
        step(4, total_steps, "Rebuild credential service")
        out, err = run_sudo_stream(
            ssh,
            f"cd {DEPLOY_DIR} && docker compose up -d --build --no-deps credential",
            timeout=300,
        )
        if "error" in err.lower() and "warning" not in err.lower():
            print(f"  ERROR: {err[:500]}")

        # Wait for container to start
        time.sleep(10)
        out, _ = run_sudo(ssh, "docker ps --filter name=aris-stg-credential --format '{{.Status}}'")
        print(f"  credential status: {out}")

        # ── Step 5: Prisma db push + seed domains ────────────────
        step(5, total_steps, "Apply Prisma schema & seed domains")
        db_url = f"postgresql://aris:{DB_PASS}@{STG_DB}:5432/aris"

        # Prisma db push (apply new Domain/UserDomain tables)
        print("  Running prisma db push...")
        out, err = run_sudo_stream(
            ssh,
            f'docker exec -e DATABASE_URL="{db_url}" -e DIRECT_DATABASE_URL="{db_url}" '
            f"aris-stg-credential npx prisma db push --schema=prisma --accept-data-loss",
            timeout=120,
        )
        if "error" in (out + err).lower() and "already" not in (out + err).lower():
            print(f"  Prisma output: {out[-300:]}")
            print(f"  Prisma errors: {err[-300:]}")
        else:
            print("  Prisma schema applied")

        # Seed domains
        print("  Seeding domains...")
        out, err = run_sudo_stream(
            ssh,
            f'docker exec -e DATABASE_URL="{db_url}" -e DIRECT_DATABASE_URL="{db_url}" '
            f"aris-stg-credential npx tsx src/seed.ts",
            timeout=120,
        )
        if out:
            for line in out.splitlines()[-5:]:
                print(f"    {line}")

        # ── Step 6: Rebuild web frontend ─────────────────────────
        step(6, total_steps, "Rebuild web frontend")
        out, err = run_sudo_stream(
            ssh,
            f"cd {DEPLOY_DIR} && docker compose up -d --build --no-deps web",
            timeout=600,
        )
        if "error" in err.lower() and "warning" not in err.lower():
            print(f"  ERROR: {err[:500]}")

        # ── Step 7: Rebuild 8 business services ──────────────────
        step(7, total_steps, f"Rebuild {len(BUSINESS_SERVICES)} business services")
        for svc in BUSINESS_SERVICES:
            print(f"\n  Building {svc}...")
            out, err = run_sudo_stream(
                ssh,
                f"cd {DEPLOY_DIR} && docker compose up -d --build --no-deps {svc}",
                timeout=300,
            )
            if "error" in err.lower() and "warning" not in err.lower():
                print(f"  ERROR building {svc}: {err[:200]}")
            else:
                print(f"  {svc} rebuilt OK")

        # ── Step 8: Rebuild other services ───────────────────────
        step(8, total_steps, f"Rebuild {len(OTHER_SERVICES)} other services")
        for svc in OTHER_SERVICES:
            print(f"\n  Building {svc}...")
            out, err = run_sudo_stream(
                ssh,
                f"cd {DEPLOY_DIR} && docker compose up -d --build --no-deps {svc}",
                timeout=300,
            )
            if "error" in err.lower() and "warning" not in err.lower():
                print(f"  ERROR building {svc}: {err[:200]}")
            else:
                print(f"  {svc} rebuilt OK")

        # ── Step 9: Health checks ────────────────────────────────
        step(9, total_steps, "Health checks on all services")
        print("  Waiting 15s for services to start...")
        time.sleep(15)

        results = {}
        for svc in ALL_SERVICES:
            port = HEALTH_PORTS.get(svc)
            if not port:
                continue
            if svc == "web":
                url = f"http://localhost:{port}/"
            else:
                url = f"http://localhost:{port}/api/v1/{svc}/health"
            out, _ = run_sudo(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' {url}", timeout=10)
            code = out.strip().replace("'", "")
            status = "OK" if code in ("200", "301", "302") else f"FAIL ({code})"
            results[svc] = status
            icon = "+" if "OK" in status else "X"
            print(f"  [{icon}] {svc:20s} → {code}")

        # ── Summary ──────────────────────────────────────────────
        ok = sum(1 for v in results.values() if "OK" in v)
        total = len(results)
        print(f"\n{'='*60}")
        print(f"  DEPLOYMENT COMPLETE: {ok}/{total} services healthy")
        print(f"  URL: https://test.au-aris.org")
        print(f"{'='*60}")

    except Exception as e:
        print(f"\nFATAL ERROR: {e}")
        sys.exit(1)
    finally:
        if ssh:
            ssh.close()


if __name__ == "__main__":
    main()
