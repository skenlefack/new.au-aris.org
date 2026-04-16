#!/usr/bin/env python3
"""
Deploy Roles & Permissions module to PRODUCTION only.
Full: git pull, prisma push, rebuild tenant+credential+web, seed roles.
"""
import paramiko
import sys
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENV = {
    "label": "PRODUCTION",
    "app_host": "10.202.101.183",
    "db_host": "10.202.101.185",
    "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
    "deploy_dir": "/opt/aris-deploy/vm-app",
    "compose_src": "deploy/vm-app/docker-compose.yml",
    "prefix": "aris",
    "url": "https://au-aris.org",
}

SERVICES = ["tenant", "credential", "web"]


def safe_print(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", "replace").decode("ascii"))


def connect(host):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)
    # Keep connection alive
    transport = ssh.get_transport()
    transport.set_keepalive(30)
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
                        "seed", "migrat", "prisma", "already up", "applied",
                        "role", "permission", "assignment",
                    ]):
                        safe_print(f"    {decoded}")
        else:
            time.sleep(0.5)
    if buf:
        decoded = buf.decode("utf-8", "replace").rstrip()
        if decoded:
            lines.append(decoded)
    return "\n".join(lines)


def main():
    safe_print("=" * 60)
    safe_print("  ARIS 4.0 — Roles Module Deploy (PRODUCTION)")
    safe_print(f"  Date: {time.strftime('%Y-%m-%d %H:%M')}")
    safe_print(f"  Host: {ENV['app_host']}")
    safe_print("=" * 60)

    errors = []
    ssh = connect(ENV["app_host"])
    safe_print(f"  Connected to {ENV['app_host']}")

    try:
        # 1. Git pull
        safe_print(f"\n  [1/6] Git pull...")
        out = sudo_stream(ssh,
            f"bash -c 'cd /opt/aris && git pull origin main 2>&1'",
            timeout=60)
        for line in (out or "").splitlines()[-5:]:
            if line.strip():
                safe_print(f"    {line}")

        # 2. Copy docker-compose.yml
        safe_print(f"\n  [2/6] Copy docker-compose.yml")
        sudo(ssh,
            f"cp /opt/aris/{ENV['compose_src']} {ENV['deploy_dir']}/docker-compose.yml",
            timeout=10)
        safe_print("  OK")

        # 3. Prisma db push
        safe_print(f"\n  [3/6] Prisma db push...")
        db_url = f"postgresql://aris:{ENV['db_pass']}@{ENV['db_host']}:5432/aris"
        container = f"{ENV['prefix']}-tenant"
        out = sudo_stream(ssh,
            f"bash -c 'docker exec "
            f"-e DATABASE_URL=\"{db_url}\" "
            f"-e DIRECT_DATABASE_URL=\"{db_url}\" "
            f"-w /app/packages/db-schemas "
            f"{container} npx prisma db push --schema=prisma --accept-data-loss 2>&1'",
            timeout=120)
        push_output = (out or "").lower()
        if "error" in push_output and "already" not in push_output and "eacces" not in push_output:
            safe_print(f"  WARN: Prisma push may have issues")
            errors.append("prisma_push")
        else:
            safe_print("  Prisma pushed OK")

        # 4. Rebuild services one by one
        for i, svc in enumerate(SERVICES, 1):
            safe_print(f"\n  [4.{i}/6] Building {svc}...")
            sudo_stream(ssh,
                f"bash -c 'cd {ENV['deploy_dir']} && docker compose up -d --build --no-deps {svc} 2>&1'",
                timeout=600 if svc == "web" else 300)

            s = sudo(ssh,
                f"docker ps --filter name={ENV['prefix']}-{svc} --format '{{{{.Status}}}}'",
                timeout=10)
            icon = "+" if "Up" in s else "X"
            safe_print(f"  [{icon}] {svc}: {s.strip()}")
            if "Up" not in s:
                errors.append(f"container_{svc}")

        # 5. Wait + seed
        safe_print(f"\n  [5/6] Waiting 15s then seeding roles...")
        time.sleep(15)

        container = f"{ENV['prefix']}-tenant"
        out = sudo_stream(ssh,
            f"bash -c 'docker exec "
            f"-e DATABASE_URL=\"{db_url}\" "
            f"-e DIRECT_DATABASE_URL=\"{db_url}\" "
            f"-w /app/packages/db-schemas "
            f"{container} npx tsx prisma/seed-roles.ts 2>&1'",
            timeout=120)

        seed_output = (out or "").lower()
        if "complete" in seed_output or "seeding" in seed_output:
            safe_print("  Seed completed OK")
        elif "error" in seed_output and "duplicate" not in seed_output:
            safe_print(f"  WARN: Seed may have issues")
            errors.append("seed")
        else:
            safe_print("  Seed finished")

        # 6. Health checks
        safe_print(f"\n  [6/6] Health checks:")
        port_map = {"tenant": 3001, "credential": 3002, "web": 3100}
        ok_count = 0
        for svc in SERVICES:
            s = sudo(ssh,
                f"docker ps --filter name={ENV['prefix']}-{svc} --format '{{{{.Status}}}}'",
                timeout=10)
            up = "Up" in s
            if up:
                ok_count += 1
            icon = "+" if up else "X"
            safe_print(f"  [{icon}] {svc:20s} :{port_map[svc]} -> {s.strip()}")

        # Summary
        safe_print(f"\n{'#'*60}")
        if ok_count == 3 and len(errors) == 0:
            safe_print(f"  PRODUCTION: OK ({ok_count}/3 containers up)")
            safe_print(f"  URL: {ENV['url']}")
        else:
            safe_print(f"  PRODUCTION: ISSUES ({ok_count}/3 up)")
            if errors:
                safe_print(f"  Errors: {', '.join(errors)}")
        safe_print(f"{'#'*60}")

        if errors:
            sys.exit(1)

    except Exception as e:
        safe_print(f"  ERROR: {e}")
        sys.exit(1)
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
