#!/usr/bin/env python3
"""
ARIS -- Deploy web container to BOTH staging and production
"""

import paramiko
import sys
import time
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVIRONMENTS = [
    {
        "name": "STAGING",
        "host": "10.202.101.146",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "compose_src": "/opt/aris/deploy/vm-app-stg/docker-compose.yml",
        "container": "aris-stg-web",
    },
    {
        "name": "PRODUCTION",
        "host": "10.202.101.183",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "compose_src": "/opt/aris/deploy/vm-app/docker-compose.yml",
        "container": "aris-web",
    },
]


def run_sudo(client, cmd, timeout=600):
    full_cmd = f"sudo -S bash -c '{cmd}'"
    stdin, stdout, stderr = client.exec_command(full_cmd, timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    err_lines = [l for l in err.split("\n") if "[sudo]" not in l and "password for" not in l.lower()]
    err = "\n".join(err_lines).strip()
    return out, err, code


def deploy(env):
    name = env["name"]
    host = env["host"]
    deploy_dir = env["deploy_dir"]
    compose_src = env["compose_src"]
    container = env["container"]

    print(f"\n{'='*70}")
    print(f"  DEPLOYING TO {name} ({host})")
    print(f"{'='*70}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)
    except Exception as e:
        print(f"  [!] Connection failed: {e}")
        return False

    print(f"  [+] Connected to {name}")

    # 1. Git pull
    print(f"\n  1. Git pull")
    out, err, code = run_sudo(client, "cd /opt/aris && git pull origin main 2>&1")
    if code != 0:
        print(f"  [!] Git pull failed: {err or out}")
        client.close()
        return False
    # Show relevant lines
    for line in out.split("\n"):
        if any(kw in line.lower() for kw in ["updating", "fast-forward", "already up", "file changed", "files changed"]):
            print(f"     {line}")
    print(f"  [OK]")

    # 2. Copy compose file
    print(f"\n  2. Copy compose file")
    out, err, code = run_sudo(client, f"cp {compose_src} {deploy_dir}/docker-compose.yml && echo COPIED")
    if "COPIED" in out:
        print(f"  [OK]")
    else:
        print(f"  [!] Copy failed: {err or out}")
        client.close()
        return False

    # 3. Build and restart web
    print(f"\n  3. Rebuild web container (this takes ~2-3 min)...")
    out, err, code = run_sudo(
        client,
        f"cd {deploy_dir} && docker compose up -d --no-deps --build web 2>&1 | tail -50",
        timeout=600,
    )

    # Check for build failure
    if "ERROR" in out and "process" in out and "did not complete successfully" in out:
        print(f"  [!] BUILD FAILED on {name}")
        # Extract error
        for line in out.split("\n"):
            if "Type error" in line or "error TS" in line or "Failed to compile" in line:
                print(f"     {line}")
        client.close()
        return False

    # Show key lines
    for line in out.split("\n"):
        low = line.lower()
        if any(kw in low for kw in ["built", "started", "recreated", "creating", "running"]):
            print(f"     {line.strip()}")
    print(f"  [OK]")

    # 4. Wait and verify
    print(f"\n  4. Waiting 15s for container to start...")
    time.sleep(15)

    out, _, code = run_sudo(client, f"docker ps --filter name={container} --format '{{{{.Names}}}} {{{{.Status}}}}'")
    print(f"     {out}")

    if "Up" not in out:
        print(f"  [!] Container not running!")
        # Get logs
        out2, _, _ = run_sudo(client, f"docker logs {container} --tail 10 2>&1")
        print(f"     Last logs: {out2[:300]}")
        client.close()
        return False

    # 5. Quick health check
    print(f"\n  5. Health check")
    out, _, code = run_sudo(client, "curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/ 2>/dev/null")
    print(f"     / -> HTTP {out}")

    client.close()
    print(f"\n  [{name}] DEPLOY SUCCESS")
    return True


def main():
    print(f"{'#'*70}")
    print(f"  ARIS -- Deploy Web to Staging + Production")
    print(f"  {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    results = {}
    for env in ENVIRONMENTS:
        success = deploy(env)
        results[env["name"]] = success

    print(f"\n{'#'*70}")
    print(f"  SUMMARY")
    print(f"{'#'*70}")
    for name, ok in results.items():
        status = "OK" if ok else "FAILED"
        print(f"  {name}: {status}")
    print(f"\n  Done -- {datetime.now().isoformat()}")
    print(f"{'#'*70}")


if __name__ == "__main__":
    main()
