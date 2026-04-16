#!/usr/bin/env python3
"""
ARIS 4.0 — Deploy AfaData migration to PROD + STG
===================================================
Deploys: fisheries, trade-sps, master-data, web
+ Prisma schema push + fishery-referentials seed

Usage:
  python deploy/scripts/_deploy_afadata.py              # Both environments
  python deploy/scripts/_deploy_afadata.py --prod       # Production only
  python deploy/scripts/_deploy_afadata.py --stg        # Staging only
"""
import paramiko
import sys
import time
import argparse

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = {
    "prod": {
        "label": "PRODUCTION",
        "url": "https://au-aris.org",
        "app_host": "10.202.101.183",
        "db_host": "10.202.101.185",
        "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
        "git_dir": "/opt/aris",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "compose_src": "deploy/vm-app/docker-compose.yml",
        "container_prefix": "aris",
    },
    "stg": {
        "label": "STAGING",
        "url": "https://test.au-aris.org",
        "app_host": "10.202.101.146",
        "db_host": "10.202.101.148",
        "db_pass": "Ar1s_Stg_2024!xK9mZ",
        "git_dir": "/opt/aris",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "compose_src": "deploy/vm-app-stg/docker-compose.yml",
        "container_prefix": "aris-stg",
    },
}

# Services affected by AfaData migration
SERVICES = ["master-data", "fisheries", "trade-sps", "web"]
HEALTH_PORTS = {
    "master-data": 3003,
    "fisheries": 3022,
    "trade-sps": 3025,
    "web": 3100,
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
                        "pulling", "building", "done", "fail", "warn",
                        "seed", "migrat", "prisma", "already up"
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


def deploy_env(env_key):
    env = ENVS[env_key]
    label = env["label"]
    total = 7
    ssh = None
    start = time.time()

    safe_print(f"\n{'#'*60}")
    safe_print(f"  DEPLOYING TO {label}")
    safe_print(f"  Host: {env['app_host']}  |  URL: {env['url']}")
    safe_print(f"{'#'*60}")

    try:
        # 1. Connect
        step(1, total, f"Connect to {label} VM-APP")
        ssh = connect(env["app_host"])
        safe_print(f"  Connected to {env['app_host']}")

        # 2. Git pull
        step(2, total, "Git pull latest code")
        out = sudo_stream(ssh,
            f"bash -c 'cd {env['git_dir']} && git pull origin main 2>&1'",
            timeout=60)
        for line in (out or "").splitlines()[-5:]:
            if line.strip():
                safe_print(f"    {line}")

        # 3. Copy docker-compose.yml
        step(3, total, "Copy docker-compose.yml to deploy directory")
        sudo(ssh,
            f"cp {env['git_dir']}/{env['compose_src']} {env['deploy_dir']}/docker-compose.yml",
            timeout=10)
        safe_print("  docker-compose.yml copied")

        # 4. Prisma db push (schema changes for fisheries, master-data, trade-sps)
        step(4, total, "Prisma schema push (fisheries + master-data + trade-sps)")
        db_url = f"postgresql://aris:{env['db_pass']}@{env['db_host']}:5432/aris"

        # Use credential container (always running) for prisma push
        container = f"{env['container_prefix']}-credential"
        safe_print("  Running prisma db push...")
        out = sudo_stream(ssh,
            f"bash -c 'docker exec -e DATABASE_URL=\"{db_url}\" -e DIRECT_DATABASE_URL=\"{db_url}\" "
            f"{container} npx prisma db push --schema=prisma --accept-data-loss 2>&1'",
            timeout=120)
        if "error" in (out or "").lower() and "already" not in (out or "").lower():
            safe_print(f"  WARN prisma: {(out or '')[-300:]}")
        else:
            safe_print("  Schema pushed OK")

        # 5. Rebuild services
        step(5, total, f"Rebuild {len(SERVICES)} services")
        for svc in SERVICES:
            safe_print(f"\n  Building {svc}...")
            sudo_stream(ssh,
                f"bash -c 'cd {env['deploy_dir']} && docker compose up -d --build --no-deps {svc} 2>&1'",
                timeout=300)
            s = sudo(ssh,
                f"docker ps --filter name={env['container_prefix']}-{svc} --format '{{{{.Status}}}}'",
                timeout=10)
            icon = "+" if "Up" in s else "?"
            safe_print(f"  [{icon}] {svc}: {s}")

        # 6. Seed fishery referentials in master-data
        step(6, total, "Seed fishery referentials")
        container_md = f"{env['container_prefix']}-master-data"
        safe_print("  Running master-data seed (fishery referentials)...")
        out = sudo_stream(ssh,
            f"bash -c 'docker exec -e DATABASE_URL=\"{db_url}\" -e DIRECT_DATABASE_URL=\"{db_url}\" "
            f"{container_md} npx tsx src/seed.ts 2>&1'",
            timeout=120)
        for line in (out or "").splitlines()[-5:]:
            if line.strip():
                safe_print(f"    {line}")

        # 7. Health checks
        step(7, total, "Health checks")
        safe_print("  Waiting 15s for containers to stabilize...")
        time.sleep(15)

        ok_count = 0
        for svc in SERVICES:
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
            safe_print(f"  [{icon}] {svc:20s} :{port} -> {code}")

        elapsed = int(time.time() - start)
        safe_print(f"\n{'='*60}")
        safe_print(f"  {label} DONE: {ok_count}/{len(SERVICES)} healthy ({elapsed}s)")
        safe_print(f"  URL: {env['url']}")
        safe_print(f"{'='*60}")
        return ok_count == len(SERVICES)

    except Exception as e:
        safe_print(f"\nFATAL ERROR ({label}): {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if ssh:
            ssh.close()


def main():
    parser = argparse.ArgumentParser(description="Deploy AfaData migration")
    parser.add_argument("--prod", action="store_true", help="Production only")
    parser.add_argument("--stg", action="store_true", help="Staging only")
    args = parser.parse_args()

    targets = []
    if args.prod:
        targets = ["prod"]
    elif args.stg:
        targets = ["stg"]
    else:
        targets = ["stg", "prod"]  # STG first, then PROD

    results = {}
    for env_key in targets:
        results[env_key] = deploy_env(env_key)

    safe_print(f"\n{'#'*60}")
    safe_print("  FINAL SUMMARY")
    safe_print(f"{'#'*60}")
    for env_key, ok in results.items():
        icon = "OK" if ok else "FAIL"
        safe_print(f"  [{icon}] {ENVS[env_key]['label']:12s} {ENVS[env_key]['url']}")
    safe_print("")

    if not all(results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
