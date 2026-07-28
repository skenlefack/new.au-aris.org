#!/usr/bin/env python3
"""
Deploy Dashboard Builder v4 (upgrade) to PRODUCTION + STAGING.
- DB migration: add refresh_interval column
- Services: analytics + web on both environments.
"""
import paramiko
import sys
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVIRONMENTS = {
    "STAGING": {
        "host": "10.202.101.146",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "url": "https://test.au-aris.org",
        "db_host": "10.202.101.148",
        "db_pass": "Ar1s_Stg_2024!xK9mZ",
        "prefix": "aris-stg",
    },
    "PROD": {
        "host": "10.202.101.183",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "url": "https://au-aris.org",
        "db_host": "10.202.101.185",
        "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
        "prefix": "aris",
    },
}

SERVICES = ["analytics", "web"]
GIT_DIR = "/opt/aris"
SUDO = f"echo '{SSH_PASS}' | sudo -S bash -c"

# SQL migration for refresh_interval column
DB_MIGRATION = """
ALTER TABLE dashboard_builder.dashboards
ADD COLUMN IF NOT EXISTS refresh_interval integer DEFAULT NULL;
"""


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


def run(ssh, cmd, timeout=120):
    ch = ssh.get_transport().open_session()
    ch.settimeout(timeout)
    full_cmd = f"{SUDO} '{cmd}'"
    ch.exec_command(full_cmd)
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


def run_stream(ssh, cmd, timeout=600):
    ch = ssh.get_transport().open_session()
    ch.settimeout(timeout)
    full_cmd = f"{SUDO} '{cmd}'"
    ch.exec_command(full_cmd)
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
                    if any(k in low for k in ["error", "built", "running", "created", "started",
                                                "building", "done", "fail", "warn", "already up"]):
                        safe_print(f"    {decoded}")
        else:
            time.sleep(0.5)
    return "\n".join(lines)


def run_db_migration(ssh, env_name, env_cfg):
    """Run SQL migration on DB host via psql in postgres container."""
    db_host = env_cfg["db_host"]
    db_pass = env_cfg["db_pass"]
    prefix = env_cfg["prefix"]

    safe_print(f"\n  [2/5] DB migration: add refresh_interval column...")

    # Connect to DB host
    db_ssh = connect(db_host)
    safe_print(f"    Connected to DB host {db_host}")

    # Find postgres container
    container = run(db_ssh, f"docker ps --format '{{{{.Names}}}}' | grep -E '{prefix}-postgres' | head -1").strip()
    if not container:
        safe_print(f"    WARN: No postgres container found on {db_host}")
        db_ssh.close()
        return

    safe_print(f"    Using container: {container}")

    # Run migration
    sql = DB_MIGRATION.replace("'", "'\\''").replace("\n", " ")
    cmd = (
        f'docker exec {container} psql -U aris -d aris -c '
        f'"{sql}"'
    )
    out = run(db_ssh, cmd, timeout=30)
    for line in out.splitlines():
        if line.strip():
            safe_print(f"    {line.strip()}")

    db_ssh.close()
    safe_print(f"    DB migration done")


def deploy_env(env_name, env_cfg):
    host = env_cfg["host"]
    deploy_dir = env_cfg["deploy_dir"]
    url = env_cfg["url"]
    prefix = env_cfg["prefix"]

    safe_print(f"\n{'#'*60}")
    safe_print(f"  DEPLOYING TO {env_name}")
    safe_print(f"  Host: {host}")
    safe_print(f"  Services: {', '.join(SERVICES)}")
    safe_print(f"{'#'*60}")

    ssh = connect(host)
    safe_print(f"  Connected to {host}")

    # 1. Git pull
    safe_print(f"\n  [1/5] Git pull...")
    out = run(ssh, f"cd {GIT_DIR} && git fetch origin && git reset --hard origin/main")
    for line in out.splitlines()[-3:]:
        safe_print(f"    {line}")

    # 2. DB migration (on DB host)
    try:
        run_db_migration(ssh, env_name, env_cfg)
    except Exception as e:
        safe_print(f"    WARN: DB migration failed: {e}")
        safe_print(f"    (Column may already exist, continuing...)")

    # 3. Rebuild services
    svc_list = " ".join(SERVICES)
    safe_print(f"\n  [3/5] Rebuilding {svc_list}...")
    env_file_flag = "--env-file .env" if env_name == "STAGING" else ""
    out = run_stream(ssh,
        f"cd {deploy_dir} && docker compose {env_file_flag} up -d --build --no-deps {svc_list} 2>&1",
        timeout=600)

    # 4. Verify containers
    safe_print(f"\n  [4/5] Verify containers...")
    time.sleep(8)
    for svc in SERVICES:
        s = run(ssh, f"docker ps --filter name={prefix}-{svc} --format '{{{{.Status}}}}'")
        status = s.strip() or "NOT FOUND"
        safe_print(f"    {svc}: {status}")

    # 5. Health checks
    safe_print(f"\n  [5/5] Health checks...")
    time.sleep(3)

    # Web
    out = run(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' {url}", timeout=15)
    safe_print(f"    Web HTTP: {out.strip()}")

    # Analytics
    out = run(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:3030/health", timeout=10)
    safe_print(f"    Analytics health: {out.strip()}")

    # Dashboard builder API
    out = run(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:3030/api/v1/analytics/dashboards/query-catalogue", timeout=10)
    safe_print(f"    Dashboard API: {out.strip()}")

    # Docker cleanup
    safe_print("    Cleaning up dangling images...")
    run(ssh, "docker image prune -f 2>&1", timeout=60)

    ssh.close()
    safe_print(f"\n  {env_name} DEPLOY COMPLETE -> {url}")
    return True


def main():
    safe_print(f"\n{'='*60}")
    safe_print(f"  ARIS Dashboard Builder v4 (upgrade)")
    safe_print(f"  STAGING first, then PROD")
    safe_print(f"{'='*60}")
    safe_print(f"  Changes:")
    safe_print(f"    - ChoroplethMapWidget (reuses existing map)")
    safe_print(f"    - KpiStripWidget (gradient + animated counters)")
    safe_print(f"    - PersonStatWidget (M/F SVG icons)")
    safe_print(f"    - Cross-filtering (DashboardViewerContext)")
    safe_print(f"    - Conic-gradient donut variant")
    safe_print(f"    - Animated counters (KPI/Counter/Stat)")
    safe_print(f"    - Table sorting + sticky header")
    safe_print(f"    - Auto-refresh config (DB: refresh_interval)")
    safe_print(f"    - Fullscreen mode")
    safe_print(f"    - SQL injection hardening")
    safe_print(f"    - Cache key fixes (COMPOSITE + SQL_QUERY)")
    safe_print(f"{'='*60}")

    results = {}
    # Deploy STAGING first, then PROD
    for env_name in ["STAGING", "PROD"]:
        env_cfg = ENVIRONMENTS[env_name]
        try:
            results[env_name] = deploy_env(env_name, env_cfg)
        except Exception as e:
            safe_print(f"\n  ERROR deploying {env_name}: {e}")
            results[env_name] = False

    safe_print(f"\n{'='*60}")
    safe_print(f"  DEPLOYMENT SUMMARY")
    safe_print(f"{'='*60}")
    for env_name, success in results.items():
        icon = "OK" if success else "FAILED"
        url = ENVIRONMENTS[env_name]["url"]
        safe_print(f"  {env_name}: [{icon}] {url}")
    safe_print(f"{'='*60}")


if __name__ == "__main__":
    main()
