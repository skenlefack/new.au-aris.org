#!/usr/bin/env python3
"""
Deploy analytics service to STAGING + PRODUCTION.
Only rebuilds the analytics container (no prisma push, no seed needed).

Usage:
  python deploy/scripts/_deploy_analytics_scope.py          # Both
  python deploy/scripts/_deploy_analytics_scope.py --stg    # Staging only
  python deploy/scripts/_deploy_analytics_scope.py --prod   # Production only
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
    "stg": {
        "label": "STAGING",
        "url": "https://test.au-aris.org",
        "app_host": "10.202.101.146",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "container_prefix": "aris-stg",
    },
    "prod": {
        "label": "PRODUCTION",
        "url": "https://au-aris.org",
        "app_host": "10.202.101.183",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "container_prefix": "aris",
    },
}

SERVICE = "analytics"


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
                        "building", "done", "fail", "warn", "already up"
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
    safe_print(f"\n{'#'*60}")
    safe_print(f"  DEPLOYING {SERVICE} TO {env['label']}")
    safe_print(f"  Host: {env['app_host']}")
    safe_print(f"{'#'*60}")

    ssh = connect(env["app_host"])
    safe_print(f"  Connected to {env['app_host']}")

    # 1. Git pull
    safe_print(f"\n  [1/3] Git pull...")
    out = sudo_stream(ssh,
        f"bash -c 'cd /opt/aris && git fetch origin && git reset --hard origin/main 2>&1'",
        timeout=60)
    for line in (out or "").splitlines()[-5:]:
        if line.strip():
            safe_print(f"    {line}")

    # 2. Rebuild analytics
    safe_print(f"\n  [2/3] Rebuild {SERVICE}...")
    sudo_stream(ssh,
        f"bash -c 'cd {env['deploy_dir']} && docker compose up -d --build --no-deps {SERVICE} 2>&1'",
        timeout=300)
    time.sleep(5)
    s = sudo(ssh,
        f"docker ps --filter name={env['container_prefix']}-{SERVICE} --format '{{{{.Status}}}}'",
        timeout=10)
    up = "Up" in s
    icon = "+" if up else "X"
    safe_print(f"  [{icon}] {SERVICE}: {s.strip()}")

    # 3. Quick health check
    safe_print(f"\n  [3/3] Health check...")
    out = sudo(ssh,
        f'curl -s -o /dev/null -w "%{{http_code}}" --max-time 10 {env["url"]}/api/v1/analytics/health',
        timeout=15)
    safe_print(f"  HTTP /api/v1/analytics/health: {out.strip()}")

    ssh.close()
    return up


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stg", action="store_true", help="Staging only")
    parser.add_argument("--prod", action="store_true", help="Production only")
    args = parser.parse_args()

    targets = []
    if args.stg:
        targets = ["stg"]
    elif args.prod:
        targets = ["prod"]
    else:
        targets = ["stg", "prod"]

    safe_print(f"Deploying {SERVICE} to: {', '.join(t.upper() for t in targets)}")
    results = {}
    for t in targets:
        try:
            results[t] = deploy_env(t)
        except Exception as e:
            safe_print(f"  ERROR deploying to {t}: {e}")
            results[t] = False

    safe_print(f"\n{'='*60}")
    safe_print("  RESULTS")
    safe_print(f"{'='*60}")
    for t, ok in results.items():
        icon = "+" if ok else "X"
        safe_print(f"  [{icon}] {ENVS[t]['label']:15s} {ENVS[t]['url']}")


if __name__ == "__main__":
    main()
