#!/usr/bin/env python3
"""
Deploy domain integration + mobile/collecte updates to PRODUCTION (au-aris.org)
Commits: 7fc67c3 (domains) + f09276c (mobile/deploy)

Services to rebuild:
  1. credential  — domain routes, JWT enrichment, Prisma schema
  2. web         — frontend domain components
  3. 8 business  — domainsHook on all routes
  4. 4 others    — analytics, collecte, form-builder, master-data
  = 14 services total

Steps:
  1. Git pull
  2. Copy docker-compose.yml
  3. Rebuild credential + Prisma db push + seed domains
  4. Rebuild web
  5. Rebuild 8 business services
  6. Rebuild 4 other services
  7. Health checks
"""
import paramiko
import sys
import time
import re

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── Production config ───────────────────────────────────────────────
PROD_APP = "10.202.101.183"
PROD_DB  = "10.202.101.185"
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
DEPLOY_DIR = "/opt/aris-deploy/vm-app"
GIT_DIR = "/opt/aris"
DB_USER = "aris"
DB_PASS = "Ar1s_Pr0d_2024!xK9mZ"
DB_NAME = "aris"

SERVICES_CREDENTIAL = ["credential"]
SERVICES_WEB = ["web"]
SERVICES_BUSINESS = [
    "animal-health", "livestock-prod", "fisheries", "wildlife",
    "apiculture", "trade-sps", "governance", "climate-env",
]
SERVICES_OTHER = ["analytics", "collecte", "form-builder", "master-data"]
ALL_SERVICES = SERVICES_CREDENTIAL + SERVICES_WEB + SERVICES_BUSINESS + SERVICES_OTHER

HEALTH_PORTS = {
    "credential": 3002, "web": 3100,
    "animal-health": 3020, "livestock-prod": 3021,
    "fisheries": 3022, "wildlife": 3023,
    "apiculture": 3024, "trade-sps": 3025,
    "governance": 3026, "climate-env": 3027,
    "analytics": 3030, "collecte": 3011,
    "form-builder": 3010, "master-data": 3003,
}


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


def sudo_stream(ssh, cmd, timeout=600):
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
                        "seed", "migrat", "prisma", "already up"
                    ]):
                        print(f"    {decoded}")
        else:
            time.sleep(0.5)
    if buf:
        decoded = buf.decode("utf-8", "replace").rstrip()
        if decoded:
            lines.append(decoded)
    return "\n".join(lines)


def step(n, total, msg):
    print(f"\n{'='*60}")
    print(f"  [{n}/{total}] {msg}")
    print(f"{'='*60}")


def main():
    total = 7
    ssh = None

    try:
        # ── 1. Connect ───────────────────────────────────────────
        step(1, total, "Connecting to PROD VM")
        ssh = connect(PROD_APP)
        print(f"  Connected to {PROD_APP}")

        # ── 2. Git pull ──────────────────────────────────────────
        step(2, total, "Git pull on /opt/aris")
        out = sudo(ssh, f"bash -c 'cd {GIT_DIR} && git pull origin main 2>&1'")
        for line in out.splitlines():
            if any(k in line.lower() for k in ["updating", "file", "changed", "already", "fast"]):
                print(f"    {line}")
        if not out.strip():
            print("    (no output)")

        # ── 3. Copy docker-compose ───────────────────────────────
        step(3, total, "Copy docker-compose.yml to deploy dir")
        out = sudo(ssh, f"cp {GIT_DIR}/deploy/vm-app/docker-compose.yml {DEPLOY_DIR}/docker-compose.yml")
        print("  docker-compose.yml copied")

        # ── 4. Rebuild credential + Prisma + seed ────────────────
        step(4, total, "Rebuild credential + Prisma db push + seed domains")

        print("  Building credential...")
        sudo_stream(ssh,
            f"bash -c 'cd {DEPLOY_DIR} && docker compose up -d --build --no-deps credential 2>&1'",
            timeout=300)

        time.sleep(10)
        status = sudo(ssh, "docker ps --filter name=aris-credential --format '{{.Status}}'")
        print(f"  credential: {status}")

        # Prisma db push
        db_url = f"postgresql://{DB_USER}:{DB_PASS}@{PROD_DB}:5432/{DB_NAME}"
        print("  Prisma db push...")
        out = sudo_stream(ssh,
            f"bash -c 'docker exec -e DATABASE_URL=\"{db_url}\" -e DIRECT_DATABASE_URL=\"{db_url}\" "
            f"aris-credential npx prisma db push --schema=prisma --accept-data-loss 2>&1'",
            timeout=120)
        if "error" in out.lower() and "already" not in out.lower():
            print(f"  WARNING: {out[-300:]}")
        else:
            print("  Schema applied OK")

        # Seed domains
        print("  Seeding domains...")
        out = sudo_stream(ssh,
            f"bash -c 'docker exec -e DATABASE_URL=\"{db_url}\" -e DIRECT_DATABASE_URL=\"{db_url}\" "
            f"aris-credential npx tsx src/seed.ts 2>&1'",
            timeout=120)
        for line in (out or "").splitlines()[-5:]:
            if line.strip():
                print(f"    {line}")

        # ── 5. Rebuild web ───────────────────────────────────────
        step(5, total, "Rebuild web frontend")
        sudo_stream(ssh,
            f"bash -c 'cd {DEPLOY_DIR} && docker compose up -d --build --no-deps web 2>&1'",
            timeout=600)

        # ── 6. Rebuild business + other services ─────────────────
        step(6, total, f"Rebuild {len(SERVICES_BUSINESS) + len(SERVICES_OTHER)} services")

        for svc in SERVICES_BUSINESS + SERVICES_OTHER:
            print(f"\n  Building {svc}...")
            sudo_stream(ssh,
                f"bash -c 'cd {DEPLOY_DIR} && docker compose up -d --build --no-deps {svc} 2>&1'",
                timeout=300)
            # Quick container check
            s = sudo(ssh, f"docker ps --filter name=aris-{svc} --format '{{{{.Status}}}}'", timeout=10)
            icon = "+" if "Up" in s else "?"
            print(f"  [{icon}] {svc}: {s}")

        # ── 7. Health checks ─────────────────────────────────────
        step(7, total, "Health checks")
        print("  Waiting 15s for startup...")
        time.sleep(15)

        ok_count = 0
        for svc in ALL_SERVICES:
            port = HEALTH_PORTS.get(svc)
            if not port:
                continue
            if svc == "web":
                url = f"http://localhost:{port}/"
            else:
                url = f"http://localhost:{port}/api/v1/{svc}/health"
            out = sudo(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' --max-time 5 {url}", timeout=15)
            code = out.strip().replace("'", "")
            ok = code in ("200", "301", "302")
            if ok:
                ok_count += 1
            icon = "+" if ok else "X"
            print(f"  [{icon}] {svc:20s} :{port} → {code}")

        # ── Summary ──────────────────────────────────────────────
        print(f"\n{'='*60}")
        print(f"  PROD DEPLOYMENT: {ok_count}/{len(ALL_SERVICES)} services healthy")
        print(f"  URL: https://au-aris.org")
        print(f"{'='*60}")

    except Exception as e:
        print(f"\nFATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if ssh:
            ssh.close()


if __name__ == "__main__":
    main()
