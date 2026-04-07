#!/usr/bin/env python3
"""
Deploy the Knowledge Management System refactor (commit 125483a) to BOTH
staging (test.au-aris.org) and production (au-aris.org).

What this script does, per environment, in order:
  1. git pull origin main on /opt/aris
  2. Copy docker-compose.yml from repo to deploy dir
  3. Rebuild containers: shared-types is dep of all → rebuild knowledge-hub,
     message, web (the 3 services touched by the KMS commit)
  4. Run `prisma db push` (drops legacy publications/elearning/faq tables,
     creates the new knowledge_categories / publications / attachments /
     reviews tables)
  5. Re-run seed-roles.ts (idempotent — adds KNOWLEDGE_MANAGER + new perms)
  6. Run seed-knowledge-hub.ts (idempotent — creates ~480 default categories)
  7. Health-check the rebuilt containers

Strategy: STAGING first (full deploy), then if all green → PRODUCTION.
"""
import paramiko
import sys
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = {
    "stg": {
        "label": "STAGING",
        "app_host": "10.202.101.146",
        "db_host": "10.202.101.148",
        "db_pass": "Ar1s_Stg_2024!xK9mZ",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "prefix": "aris-stg",
        "url": "https://test.au-aris.org",
    },
    "prod": {
        "label": "PRODUCTION",
        "app_host": "10.202.101.183",
        "db_host": "10.202.101.185",
        "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "prefix": "aris",
        "url": "https://au-aris.org",
    },
}

# Services touched by the KMS commit (credential is rebuilt so its Prisma
# client picks up the new KNOWLEDGE_MANAGER enum value before seed-roles runs)
SERVICES = ["credential", "knowledge-hub", "message", "web"]
SERVICE_PORTS = {"credential": 3002, "knowledge-hub": 3033, "message": 3006, "web": 3100}


def safe_print(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", "replace").decode("ascii"))


def connect(host):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)
    return ssh


def sudo(ssh, cmd, timeout=120):
    ch = ssh.get_transport().open_session()
    ch.settimeout(timeout)
    ch.exec_command("sudo -S " + cmd)
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
    lines = [l for l in out.decode("utf-8", "replace").splitlines()
             if "[sudo]" not in l and "password" not in l.lower()]
    return "\n".join(lines)


def sudo_stream(ssh, cmd, timeout=900):
    ch = ssh.get_transport().open_session()
    ch.settimeout(timeout)
    ch.exec_command("sudo -S " + cmd)
    ch.sendall((SSH_PASS + "\n").encode())
    time.sleep(0.5)
    lines = []
    buf = b""
    while not ch.exit_status_ready() or ch.recv_ready():
        if ch.recv_ready():
            buf += ch.recv(65536)
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                decoded = line.decode("utf-8", "replace").rstrip()
                if decoded and "[sudo]" not in decoded and "password" not in decoded.lower():
                    lines.append(decoded)
                    low = decoded.lower()
                    if any(k in low for k in [
                        "error", "built", "running", "created", "started",
                        "pulling", "building", "done", "fail", "warn",
                        "seed", "migrat", "prisma", "applied", "category",
                        "knowledge", "datamodel"
                    ]):
                        safe_print(f"    {decoded}")
        else:
            time.sleep(0.5)
    if buf:
        decoded = buf.decode("utf-8", "replace").rstrip()
        if decoded:
            lines.append(decoded)
    return "\n".join(lines)


def step(n, total, msg):
    safe_print(f"\n{'='*64}")
    safe_print(f"  [{n}/{total}] {msg}")
    safe_print(f"{'='*64}")


def deploy(env):
    """Full KMS deploy for one environment."""
    total = 7
    safe_print(f"\n{'#'*64}")
    safe_print(f"  Deploying KMS to {env['label']}  ({env['app_host']})")
    safe_print(f"{'#'*64}")

    ssh = connect(env["app_host"])
    safe_print(f"  Connected to {env['app_host']}")

    db_url = f"postgresql://aris:{env['db_pass']}@{env['db_host']}:5432/aris"

    # 1. git pull
    step(1, total, "git pull origin main")
    out = sudo_stream(ssh, "bash -c 'cd /opt/aris && git pull origin main 2>&1'", timeout=120)
    for line in (out or "").splitlines()[-6:]:
        if line.strip():
            safe_print(f"    {line}")

    # 2. copy compose
    step(2, total, "Copy docker-compose.yml")
    sudo(ssh, f"cp /opt/aris/deploy/vm-app/docker-compose.yml {env['deploy_dir']}/docker-compose.yml", timeout=10)
    safe_print("    Copied")

    # 3. rebuild services
    step(3, total, f"Rebuild {len(SERVICES)} services: {', '.join(SERVICES)}")
    rebuild_failures = []
    for svc in SERVICES:
        safe_print(f"\n  → Building {svc}…")
        out = sudo_stream(ssh,
            f"bash -c 'cd {env['deploy_dir']} && docker compose up -d --build --no-deps {svc} 2>&1; echo BUILD_EXIT=$?'",
            timeout=1200 if svc == "web" else 900)
        # Use the explicit BUILD_EXIT marker rather than scanning for "ERROR"
        # which produces false positives (postinstall warnings, etc).
        exit_line = [l for l in (out or "").splitlines() if "BUILD_EXIT=" in l]
        exit_code = exit_line[-1].split("BUILD_EXIT=")[-1].strip() if exit_line else "?"
        if exit_code != "0":
            rebuild_failures.append(svc)
            safe_print(f"  [X] {svc}: BUILD FAILED (exit={exit_code})")
        else:
            s = sudo(ssh, f"docker ps --filter name={env['prefix']}-{svc} --format '{{{{.Status}}}}'", timeout=10)
            safe_print(f"  [+] {svc}: {s.strip()}")
    if rebuild_failures:
        safe_print(f"\n  !! Rebuild failures: {rebuild_failures}")
        ssh.close()
        return False

    # 4. prisma db push (DESTRUCTIVE — drops legacy KH tables, creates new ones)
    step(4, total, "Prisma db push (drops legacy KH tables, creates new schema)")
    container_kh = f"{env['prefix']}-knowledge-hub"
    out = sudo_stream(ssh,
        f"bash -c 'docker exec "
        f"-e DATABASE_URL=\"{db_url}\" "
        f"-e DIRECT_DATABASE_URL=\"{db_url}\" "
        f"-w /app/packages/db-schemas "
        f"{container_kh} npx prisma db push --schema=prisma --accept-data-loss 2>&1'",
        timeout=180)
    if "error" in (out or "").lower() and "already" not in (out or "").lower():
        safe_print(f"    !! prisma push errors: {(out or '')[-400:]}")
    else:
        safe_print("    Prisma schema push OK")

    # 5. seed-roles (idempotent — adds KNOWLEDGE_MANAGER role + perms)
    step(5, total, "Seed roles (idempotent)")
    container_cred = f"{env['prefix']}-credential"
    out = sudo_stream(ssh,
        f"bash -c 'docker exec "
        f"-e DATABASE_URL=\"{db_url}\" -e DIRECT_DATABASE_URL=\"{db_url}\" "
        f"-w /app/packages/db-schemas "
        f"{container_cred} npx tsx prisma/seed-roles.ts 2>&1'",
        timeout=180)
    for line in (out or "").splitlines()[-15:]:
        if line.strip():
            safe_print(f"    {line}")

    # 6. seed-knowledge-hub (creates default categories)
    step(6, total, "Seed knowledge-hub default categories")
    out = sudo_stream(ssh,
        f"bash -c 'docker exec "
        f"-e DATABASE_URL=\"{db_url}\" -e DIRECT_DATABASE_URL=\"{db_url}\" "
        f"-w /app/packages/db-schemas "
        f"{container_kh} npx tsx prisma/seed-knowledge-hub.ts 2>&1'",
        timeout=240)
    for line in (out or "").splitlines()[-20:]:
        if line.strip():
            safe_print(f"    {line}")

    # 7. health checks
    step(7, total, "Health checks")
    safe_print("    Waiting 12s for services to settle…")
    time.sleep(12)
    ok = 0
    for svc in SERVICES:
        port = SERVICE_PORTS[svc]
        s = sudo(ssh, f"docker ps --filter name={env['prefix']}-{svc} --format '{{{{.Status}}}}'", timeout=10)
        up = "Up" in s
        if up:
            ok += 1
        icon = "[+]" if up else "[X]"
        safe_print(f"  {icon} {svc:18s} :{port} → {s.strip() or 'NOT RUNNING'}")

    ssh.close()
    return ok == len(SERVICES)


def main():
    results = {}

    # 1. STAGING first
    results["stg"] = deploy(ENVS["stg"])

    if not results["stg"]:
        safe_print("\n" + "!" * 64)
        safe_print("  STAGING DEPLOY FAILED — aborting before PRODUCTION")
        safe_print("!" * 64)
        sys.exit(1)

    safe_print("\n" + "=" * 64)
    safe_print("  STAGING green — proceeding to PRODUCTION")
    safe_print("=" * 64)
    time.sleep(3)

    # 2. PRODUCTION
    results["prod"] = deploy(ENVS["prod"])

    # Summary
    safe_print(f"\n{'#'*64}")
    safe_print("  FINAL SUMMARY")
    safe_print(f"{'#'*64}")
    safe_print(f"  STAGING:    {'OK' if results['stg'] else 'FAIL'}  →  {ENVS['stg']['url']}/knowledge")
    safe_print(f"  PRODUCTION: {'OK' if results['prod'] else 'FAIL'}  →  {ENVS['prod']['url']}/knowledge")
    safe_print("")

    if not all(results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
