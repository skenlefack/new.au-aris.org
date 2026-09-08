#!/usr/bin/env python3
"""
Fix: add PAID_ADMIN to PostgreSQL enum + rebuild tenant service on PROD + STG.
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
        "pg_container": "aris-stg-postgres",
    },
    "prod": {
        "label": "PRODUCTION",
        "app_host": "10.202.101.183",
        "db_host": "10.202.101.185",
        "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "prefix": "aris",
        "pg_container": "aris-postgres",
    },
}


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
                        "building", "done", "fail", "warn", "already up",
                        "alter", "role"
                    ]):
                        safe_print(f"    {decoded}")
        else:
            time.sleep(0.5)
    if buf:
        decoded = buf.decode("utf-8", "replace").rstrip()
        if decoded:
            lines.append(decoded)
    return "\n".join(lines)


def fix_env(env_key):
    env = ENVS[env_key]
    safe_print(f"\n{'#'*60}")
    safe_print(f"  {env['label']}")
    safe_print(f"{'#'*60}")

    # Step 1: Add PAID_ADMIN to PostgreSQL enum on DB host
    safe_print(f"\n  [1/4] Add PAID_ADMIN to PostgreSQL enum...")
    db_ssh = connect(env["db_host"])
    sql = "ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'PAID_ADMIN';"
    out = sudo(db_ssh,
        f"docker exec {env['pg_container']} psql -U aris -d aris -c \"{sql}\"",
        timeout=15)
    safe_print(f"    {out.strip()}")

    # Verify
    out = sudo(db_ssh,
        f"docker exec {env['pg_container']} psql -U aris -d aris -t -c "
        f"\"SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role') ORDER BY enumsortorder;\"",
        timeout=15)
    roles = [r.strip() for r in out.strip().splitlines() if r.strip()]
    has_paid = "PAID_ADMIN" in roles
    safe_print(f"    PAID_ADMIN in enum: {'YES' if has_paid else 'NO'}")
    safe_print(f"    All roles: {', '.join(roles)}")
    db_ssh.close()

    # Step 2: Git pull on app host
    safe_print(f"\n  [2/4] Git pull...")
    app_ssh = connect(env["app_host"])
    sudo_stream(app_ssh,
        "bash -c 'cd /opt/aris && git fetch origin && git reset --hard origin/main 2>&1'",
        timeout=60)

    # Step 3: Prisma db push via tenant container
    safe_print(f"\n  [3/4] Prisma db push...")
    db_url = f"postgresql://aris:{env['db_pass']}@{env['db_host']}:5432/aris"
    container = f"{env['prefix']}-tenant"
    out = sudo_stream(app_ssh,
        f"bash -c 'docker exec "
        f"-e DATABASE_URL=\"{db_url}\" "
        f"-e DIRECT_DATABASE_URL=\"{db_url}\" "
        f"-w /app/packages/db-schemas "
        f"{container} npx prisma db push --schema=prisma --accept-data-loss 2>&1'",
        timeout=120)
    if "error" in (out or "").lower() and "already" not in (out or "").lower():
        safe_print(f"    WARN: {(out or '')[-300:]}")
    else:
        safe_print("    Prisma schema pushed OK")

    # Step 4: Rebuild tenant service (it serves /api/v1/settings/users)
    safe_print(f"\n  [4/4] Rebuild tenant service...")
    sudo_stream(app_ssh,
        f"bash -c 'cd {env['deploy_dir']} && docker compose up -d --build --no-deps tenant 2>&1'",
        timeout=600)
    time.sleep(5)
    s = sudo(app_ssh,
        f"docker ps --filter name={env['prefix']}-tenant --format '{{{{.Status}}}}'",
        timeout=10)
    up = "Up" in s
    safe_print(f"    tenant: {'UP' if up else 'DOWN'} ({s.strip()})")
    app_ssh.close()
    return up


results = {}
for env_key in ["stg", "prod"]:
    try:
        results[env_key] = fix_env(env_key)
    except Exception as e:
        safe_print(f"  ERROR: {e}")
        results[env_key] = False

safe_print(f"\n{'='*60}")
safe_print("  RESULTS")
safe_print(f"{'='*60}")
for k, ok in results.items():
    icon = "+" if ok else "X"
    safe_print(f"  [{icon}] {ENVS[k]['label']}")
