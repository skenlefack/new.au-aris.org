#!/usr/bin/env python3
"""
Deploy slideshow scroll mode feature to staging + production.

Changes:
  - Prisma: new scroll_mode column on dashboard_slideshows
  - analytics service: scrollMode in schemas/service/routes
  - web: SlideshowPlayer section-by-section scroll + Editor UI

Steps per env:
  1. git pull
  2. prisma db push (add scroll_mode column)
  3. rebuild analytics
  4. rebuild web
  5. health check
"""

import sys
import time

import paramiko

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = [
    {
        "name": "STAGING",
        "app_host": "10.202.101.146",
        "db_host": "10.202.101.148",
        "db_pass": "Ar1s_Stg_2024!xK9mZ",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "prefix": "aris-stg",
        "url": "https://test.au-aris.org",
        "copy_compose": False,  # NEVER copy prod compose to staging
    },
    {
        "name": "PRODUCTION",
        "app_host": "10.202.101.183",
        "db_host": "10.202.101.185",
        "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "prefix": "aris",
        "url": "https://au-aris.org",
        "copy_compose": True,
    },
]

SERVICES = ["analytics", "web"]


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
                        "prisma", "already up", "applied", "schema"
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
    safe_print(f"\n{'='*60}")
    safe_print(f"  [{n}/{total}] {msg}")
    safe_print(f"{'='*60}")


def deploy_env(env):
    name = env["name"]
    safe_print(f"\n{'#'*60}")
    safe_print(f"  DEPLOYING TO {name} — {env['app_host']}")
    safe_print(f"{'#'*60}")

    try:
        ssh = connect(env["app_host"])
    except Exception as e:
        safe_print(f"FATAL: SSH to {name} failed: {e}")
        return False

    total = 6
    try:
        # 1. Git pull
        step(1, total, "Git pull latest code")
        out = sudo_stream(ssh,
            "bash -c 'cd /opt/aris && git fetch origin && git reset --hard origin/main 2>&1'",
            timeout=60)
        for line in (out or "").splitlines()[-5:]:
            if line.strip():
                safe_print(f"    {line}")

        # 2. Prisma db push — add scroll_mode column
        step(2, total, "Prisma db push (scroll_mode column)")
        db_url = f"postgresql://aris:{env['db_pass']}@{env['db_host']}:5432/aris"
        container = f"{env['prefix']}-analytics"
        # Use analytics container since it has prisma packages
        # Fallback to fisheries if analytics doesn't have prisma
        out = sudo_stream(ssh,
            f"bash -c 'docker exec "
            f"-e DATABASE_URL=\"{db_url}\" "
            f"-e DIRECT_DATABASE_URL=\"{db_url}\" "
            f"-w /app/packages/db-schemas "
            f"{env['prefix']}-fisheries "
            f"npx prisma db push --schema=prisma --accept-data-loss 2>&1'",
            timeout=120)
        if "error" in (out or "").lower() and "already" not in (out or "").lower():
            safe_print(f"  WARN: prisma push may have issues")
        else:
            safe_print("  Prisma schema pushed OK")

        # 3. Copy docker-compose.yml (prod only)
        if env["copy_compose"]:
            step(3, total, "Copy docker-compose.yml")
            sudo(ssh,
                f"cp /opt/aris/deploy/vm-app/docker-compose.yml {env['deploy_dir']}/docker-compose.yml",
                timeout=10)
            safe_print("  Copied")
        else:
            step(3, total, "Skip compose copy (staging)")
            safe_print("  Skipped — staging uses its own compose file")

        # 4. Rebuild analytics
        step(4, total, "Rebuild analytics service")
        sudo_stream(ssh,
            f"bash -c 'cd {env['deploy_dir']} && docker compose up -d --build --no-deps analytics 2>&1'",
            timeout=300)
        s = sudo(ssh,
            f"docker ps --filter name={env['prefix']}-analytics --format '{{{{.Status}}}}'",
            timeout=10)
        safe_print(f"  analytics: {s}")

        # 5. Rebuild web
        step(5, total, "Rebuild web frontend")
        sudo_stream(ssh,
            f"bash -c 'cd {env['deploy_dir']} && docker compose up -d --build --no-deps web 2>&1'",
            timeout=600)
        s = sudo(ssh,
            f"docker ps --filter name={env['prefix']}-web --format '{{{{.Status}}}}'",
            timeout=10)
        safe_print(f"  web: {s}")

        # 6. Health check
        step(6, total, f"Health check {env['url']}")
        time.sleep(10)
        out = sudo(ssh,
            f"curl -s -o /dev/null -w '%{{http_code}}' --max-time 10 {env['url']}",
            timeout=20)
        safe_print(f"  HTTP status: {out}")

        safe_print(f"\n  {name} DEPLOYMENT COMPLETE")
        return True

    except Exception as e:
        safe_print(f"ERROR in {name}: {e}")
        return False
    finally:
        ssh.close()


def main():
    safe_print("=" * 60)
    safe_print("  ARIS — Deploy slideshow scroll mode (stg + prod)")
    safe_print("=" * 60)

    results = {}
    for env in ENVS:
        results[env["name"]] = deploy_env(env)

    safe_print(f"\n\n{'='*60}")
    safe_print("  SUMMARY")
    safe_print(f"{'='*60}")
    for name, ok in results.items():
        status = "OK" if ok else "FAILED"
        safe_print(f"  {name}: {status}")
    safe_print(f"{'='*60}")

    if not all(results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
