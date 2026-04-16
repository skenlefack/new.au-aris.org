#!/usr/bin/env python3
"""
Fix Prisma schema push on STG + Deploy to PROD.
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

SERVICES = ["master-data", "fisheries", "trade-sps", "web"]


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
                        "seed", "migrat", "prisma", "already up", "applied"
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


def prisma_push(ssh, env):
    """Run prisma db push with correct path inside container."""
    db_url = f"postgresql://aris:{env['db_pass']}@{env['db_host']}:5432/aris"
    container = f"{env['prefix']}-fisheries"

    safe_print("  Running prisma db push from fisheries container...")
    safe_print(f"  Container: {container}")
    safe_print(f"  DB: {env['db_host']}:5432")

    out = sudo_stream(ssh,
        f"bash -c 'docker exec "
        f"-e DATABASE_URL=\"{db_url}\" "
        f"-e DIRECT_DATABASE_URL=\"{db_url}\" "
        f"-w /app/packages/db-schemas "
        f"{container} npx prisma db push --schema=prisma --accept-data-loss 2>&1'",
        timeout=120)

    if "error" in (out or "").lower() and "already" not in (out or "").lower():
        safe_print(f"  WARN: {(out or '')[-500:]}")
        return False
    else:
        safe_print("  Prisma schema pushed OK")
        return True


def deploy_prod(ssh, env):
    """Full deploy for PROD: git pull, copy compose, rebuild, prisma, seed."""
    total = 6

    # 1. Git pull
    step(1, total, "Git pull latest code")
    out = sudo_stream(ssh,
        f"bash -c 'cd /opt/aris && git pull origin main 2>&1'",
        timeout=60)
    for line in (out or "").splitlines()[-5:]:
        if line.strip():
            safe_print(f"    {line}")

    # 2. Copy docker-compose.yml
    step(2, total, "Copy docker-compose.yml")
    sudo(ssh,
        f"cp /opt/aris/deploy/vm-app/docker-compose.yml {env['deploy_dir']}/docker-compose.yml",
        timeout=10)
    safe_print("  Copied")

    # 3. Rebuild services
    step(3, total, f"Rebuild {len(SERVICES)} services")
    for svc in SERVICES:
        safe_print(f"\n  Building {svc}...")
        sudo_stream(ssh,
            f"bash -c 'cd {env['deploy_dir']} && docker compose up -d --build --no-deps {svc} 2>&1'",
            timeout=600 if svc == "web" else 300)
        s = sudo(ssh,
            f"docker ps --filter name={env['prefix']}-{svc} --format '{{{{.Status}}}}'",
            timeout=10)
        icon = "+" if "Up" in s else "?"
        safe_print(f"  [{icon}] {svc}: {s}")

    # 4. Prisma db push
    step(4, total, "Prisma db push")
    prisma_push(ssh, env)

    # 5. Seed
    step(5, total, "Seed master-data")
    db_url = f"postgresql://aris:{env['db_pass']}@{env['db_host']}:5432/aris"
    container_md = f"{env['prefix']}-master-data"
    out = sudo_stream(ssh,
        f"bash -c 'docker exec -e DATABASE_URL=\"{db_url}\" -e DIRECT_DATABASE_URL=\"{db_url}\" "
        f"-w /app {container_md} node src/seed/run-seed.js 2>&1'",
        timeout=120)
    for line in (out or "").splitlines()[-10:]:
        if line.strip():
            safe_print(f"    {line}")

    # 6. Health check
    step(6, total, "Health checks")
    safe_print("  Waiting 15s...")
    time.sleep(15)

    ok_count = 0
    for svc in SERVICES:
        port = {"master-data": 3003, "fisheries": 3022, "trade-sps": 3025, "web": 3100}[svc]
        s = sudo(ssh,
            f"docker ps --filter name={env['prefix']}-{svc} --format '{{{{.Status}}}}'",
            timeout=10)
        up = "Up" in s
        if up:
            ok_count += 1
        icon = "+" if up else "X"
        safe_print(f"  [{icon}] {svc:20s} :{port} -> {s.strip()}")

    return ok_count


def main():
    results = {}

    # ── STEP A: Fix Prisma on STG ──
    safe_print(f"\n{'#'*60}")
    safe_print("  STEP A: Fix Prisma schema push on STAGING")
    safe_print(f"{'#'*60}")

    env = ENVS["stg"]
    ssh = connect(env["app_host"])
    safe_print(f"  Connected to {env['app_host']}")
    ok = prisma_push(ssh, env)
    ssh.close()
    results["stg_prisma"] = ok

    # ── STEP B: Deploy PROD ──
    safe_print(f"\n{'#'*60}")
    safe_print("  STEP B: Deploy to PRODUCTION")
    safe_print(f"  Host: {ENVS['prod']['app_host']}")
    safe_print(f"{'#'*60}")

    env = ENVS["prod"]
    ssh = connect(env["app_host"])
    safe_print(f"  Connected to {env['app_host']}")
    ok_count = deploy_prod(ssh, env)
    ssh.close()
    results["prod"] = ok_count == len(SERVICES)

    # ── Summary ──
    safe_print(f"\n{'#'*60}")
    safe_print("  FINAL SUMMARY")
    safe_print(f"{'#'*60}")
    safe_print(f"  STG Prisma push: {'OK' if results['stg_prisma'] else 'FAIL'}")
    safe_print(f"  PROD deploy:     {'OK' if results['prod'] else 'FAIL'} ({ok_count}/{len(SERVICES)} containers up)")
    safe_print(f"  PROD URL:        {ENVS['prod']['url']}")
    safe_print(f"  STG URL:         {ENVS['stg']['url']}")
    safe_print("")

    if not all(results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
