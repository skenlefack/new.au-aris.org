#!/usr/bin/env python3
"""
Deploy ARIS web + analytics to both production and staging.

Services deployed:
  - web (Next.js frontend — new legal pages + footer links)
  - analytics (continental KPIs endpoints)

Environments:
  - PROD: 10.202.101.183  /opt/aris-deploy/vm-app/
  - STG:  10.202.101.146  /opt/aris-deploy/vm-app-stg/
"""

import sys
import time

import paramiko


USER = "arisadmin"
PASSWORD = "@u-1baR.0rg$U24"

ENVIRONMENTS = [
    {
        "name": "PRODUCTION",
        "host": "10.202.101.183",
        "code_dir": "/opt/aris",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "health_url": "https://au-aris.org",
    },
    {
        "name": "STAGING",
        "host": "10.202.101.146",
        "code_dir": "/opt/aris",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "health_url": "https://test.au-aris.org",
    },
]

SERVICES = ["web", "analytics"]


def run_command(ssh, cmd, label, timeout=120):
    """Execute a command over SSH, print stdout/stderr, return True on success."""
    print(f"\n{'='*60}")
    print(f"STEP: {label}")
    print(f"CMD:  {cmd}")
    print(f"{'='*60}")

    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)

    if "sudo" in cmd:
        time.sleep(1)
        stdin.write(PASSWORD + "\n")
        stdin.flush()

    exit_code = stdout.channel.recv_exit_status()

    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()

    if out:
        lines = [l for l in out.splitlines() if "[sudo] password" not in l and PASSWORD not in l]
        filtered = "\n".join(lines).strip()
        if filtered:
            print(f"OUTPUT:\n{filtered}")
    if err:
        lines = [l for l in err.splitlines() if "[sudo] password" not in l]
        filtered = "\n".join(lines).strip()
        if filtered:
            print(f"STDERR:\n{filtered}")
    print(f"EXIT CODE: {exit_code}")

    if exit_code != 0:
        print(f"WARNING: Non-zero exit code ({exit_code}) for step: {label}")
        return False
    return True


def deploy_env(env):
    """Deploy services to one environment."""
    name = env["name"]
    host = env["host"]
    code_dir = env["code_dir"]
    deploy_dir = env["deploy_dir"]
    health_url = env["health_url"]

    print(f"\n{'#'*60}")
    print(f"  DEPLOYING TO {name} — {host}")
    print(f"{'#'*60}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        print(f"\nConnecting to {host} as {USER} ...")
        ssh.connect(host, port=22, username=USER, password=PASSWORD, timeout=15)
        print("SSH connection established.")
    except Exception as exc:
        print(f"FATAL: SSH connection to {name} failed: {exc}")
        return False

    try:
        # 1. git pull
        ok = run_command(
            ssh,
            f"cd {code_dir} && sudo git pull origin main",
            f"[{name}] Git pull latest code",
        )
        if not ok:
            print("WARNING: git pull reported issues - continuing anyway.")

        # 2. Copy docker-compose.yml
        ok = run_command(
            ssh,
            f"sudo cp {code_dir}/deploy/vm-app/docker-compose.yml {deploy_dir}/docker-compose.yml",
            f"[{name}] Copy docker-compose.yml to deploy directory",
        )
        if not ok:
            print("ERROR: Failed to copy docker-compose.yml.")
            return False

        # 3. Rebuild each service
        for svc in SERVICES:
            ok = run_command(
                ssh,
                f"cd {deploy_dir} && sudo docker compose up -d --build --no-deps {svc}",
                f"[{name}] Rebuild and restart '{svc}'",
                timeout=300,
            )
            if not ok:
                print(f"Checking docker logs for {svc}...")
                run_command(
                    ssh,
                    f"cd {deploy_dir} && sudo docker compose logs --tail=50 {svc}",
                    f"[{name}] Docker logs for {svc}",
                    timeout=30,
                )

        # 4. Wait and health-check
        print(f"\nWaiting 15 seconds for containers to start ...")
        time.sleep(15)

        run_command(
            ssh,
            f'curl -s -o /dev/null -w "%{{http_code}}" --max-time 10 {health_url}',
            f"[{name}] Health-check {health_url}",
        )

        # 5. Show container statuses
        svc_list = " ".join(SERVICES)
        run_command(
            ssh,
            f"cd {deploy_dir} && sudo docker compose ps {svc_list}",
            f"[{name}] Container status",
        )

        print(f"\n{'='*60}")
        print(f"  {name} DEPLOYMENT COMPLETE")
        print(f"{'='*60}")
        return True

    finally:
        ssh.close()
        print(f"SSH connection to {name} closed.")


def main():
    print("=" * 60)
    print("  ARIS — Deploy web + analytics (prod + staging)")
    print("=" * 60)

    results = {}
    for env in ENVIRONMENTS:
        results[env["name"]] = deploy_env(env)

    print(f"\n\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    for name, ok in results.items():
        status = "OK" if ok else "FAILED"
        print(f"  {name}: {status}")
    print(f"{'='*60}")

    if not all(results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
