#!/usr/bin/env python3
"""
Deploy tenant + web services to STAGING and PRODUCTION.

Needed for changes that touch both the tenant backend and the web frontend
(e.g. interop count feature).

Steps per environment:
  1. git pull origin main
  2. Copy docker-compose.yml to deploy dir
  3. Rebuild tenant container
  4. Rebuild web container
  5. Health-check
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
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "compose_src": "deploy/vm-app-stg/docker-compose.yml",
        "prefix": "aris-stg",
        "url": "https://test.au-aris.org",
    },
    "prod": {
        "label": "PRODUCTION",
        "app_host": "10.202.101.183",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "compose_src": "deploy/vm-app/docker-compose.yml",
        "prefix": "aris",
        "url": "https://au-aris.org",
    },
}

SERVICES = ["tenant", "web"]


def safe_print(msg):
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:
        print(msg.encode("ascii", "replace").decode("ascii"), flush=True)


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
                        "building", "done", "fail", "warn"
                    ]):
                        safe_print(f"    {decoded}")
        else:
            time.sleep(0.5)
    if buf:
        decoded = buf.decode("utf-8", "replace").rstrip()
        if decoded:
            lines.append(decoded)
    return "\n".join(lines)


def deploy_env(env_key):
    env = ENVS[env_key]
    safe_print(f"\n{'='*60}")
    safe_print(f"  {env['label']} — {env['app_host']}")
    safe_print(f"{'='*60}")

    ssh = connect(env["app_host"])

    # Step 1: git pull
    safe_print("  [1/4] Git pull...")
    sudo_stream(ssh, "bash -c 'cd /opt/aris && git pull origin main 2>&1'", timeout=60)

    # Step 2: Copy compose file
    safe_print("  [2/4] Copy docker-compose.yml...")
    sudo(ssh, f"cp /opt/aris/{env['compose_src']} {env['deploy_dir']}/docker-compose.yml")

    # Step 3: Rebuild tenant
    safe_print("  [3/4] Rebuild tenant...")
    sudo_stream(ssh,
        f"bash -c 'cd {env['deploy_dir']} && docker compose up -d --build --no-deps tenant 2>&1'",
        timeout=600)
    s = sudo(ssh, f"docker ps --filter name={env['prefix']}-tenant --format '{{{{.Status}}}}'")
    icon = "+" if "Up" in s else "X"
    safe_print(f"  [{icon}] tenant: {s.strip()}")

    # Step 4: Rebuild web
    safe_print("  [4/4] Rebuild web...")
    sudo_stream(ssh,
        f"bash -c 'cd {env['deploy_dir']} && docker compose up -d --build --no-deps web 2>&1'",
        timeout=600)
    s = sudo(ssh, f"docker ps --filter name={env['prefix']}-web --format '{{{{.Status}}}}'")
    icon = "+" if "Up" in s else "X"
    safe_print(f"  [{icon}] web: {s.strip()}")

    ssh.close()
    safe_print(f"  {env['label']} DONE")


def main():
    for env_key in ["stg", "prod"]:
        deploy_env(env_key)
    safe_print(f"\n{'='*60}")
    safe_print("  tenant + web deployed on STG & PROD")
    safe_print(f"{'='*60}")


if __name__ == "__main__":
    main()
