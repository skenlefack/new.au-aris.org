#!/usr/bin/env python3
"""
ARIS — Fix Veeam false-positive (internmap/nmap IoC)
1. git pull on nbo-aris04
2. Copy updated Dockerfile.service to deploy dir
3. Rebuild all services with --no-cache
4. Restart services
5. Prune old Docker layers
6. Verify internmap is gone
"""

import paramiko
import sys
import time
from datetime import datetime

VM_APP = {
    "ip": "10.202.101.183",
    "user": "arisadmin",
    "password": "@u-1baR.0rg$U24",
}


def run_cmd(client, cmd, password=None, timeout=600):
    """Run command, optionally with sudo password."""
    if password and cmd.strip().startswith("sudo"):
        cmd = cmd.replace("sudo ", "sudo -S ", 1)
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    if password and "sudo -S" in cmd:
        stdin.write(password + "\n")
        stdin.flush()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err_lines = [l for l in err.split("\n") if "[sudo]" not in l and "password" not in l.lower()]
    err = "\n".join(err_lines).strip()
    exit_code = stdout.channel.recv_exit_status()
    return out, err, exit_code


def step(client, title, cmd, use_sudo=False):
    """Run and display a deployment step."""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"  CMD: {cmd}")
    print(f"{'='*70}")
    pwd = VM_APP["password"] if use_sudo else None
    out, err, code = run_cmd(client, cmd, password=pwd, timeout=600)
    if out:
        print(out)
    if err:
        print(f"  [STDERR] {err}")
    if code != 0:
        print(f"  [EXIT CODE] {code}")
    return out, err, code


def main():
    print(f"\n{'#'*70}")
    print(f"  ARIS — Fix Veeam IoC False Positive")
    print(f"  Target: nbo-aris04 ({VM_APP['ip']})")
    print(f"  Time: {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        print(f"\n[*] Connecting to {VM_APP['ip']}...")
        client.connect(
            hostname=VM_APP["ip"],
            username=VM_APP["user"],
            password=VM_APP["password"],
            timeout=15,
        )
        print("[+] Connected.\n")

        # Step 1: Git pull
        step(client, "STEP 1/6 — Git pull latest code", "cd /opt/aris && git pull origin main")

        # Step 2: Copy Dockerfile.service to deploy dir
        step(client, "STEP 2/6 — Copy updated Dockerfile to deploy dir",
             "sudo cp /opt/aris/Dockerfile.service /opt/aris-deploy/vm-app/Dockerfile.service && "
             "sudo cp /opt/aris/deploy/vm-app/docker-compose.yml /opt/aris-deploy/vm-app/docker-compose.yml",
             use_sudo=True)

        # Step 3: Rebuild all services (no-cache to force fresh layers)
        print(f"\n{'='*70}")
        print(f"  STEP 3/6 — Rebuild services (--no-cache)")
        print(f"  This will take several minutes...")
        print(f"{'='*70}")
        step(client, "STEP 3/6 — Docker compose build",
             "cd /opt/aris-deploy/vm-app && sudo docker compose build --no-cache",
             use_sudo=True)

        # Step 4: Restart services
        step(client, "STEP 4/6 — Restart services",
             "cd /opt/aris-deploy/vm-app && sudo docker compose up -d",
             use_sudo=True)

        # Step 5: Prune old Docker layers
        step(client, "STEP 5/6 — Prune old Docker layers and build cache",
             "sudo docker builder prune -f && sudo docker image prune -f",
             use_sudo=True)

        # Step 6: Verify internmap is gone
        step(client, "STEP 6/6 — Verify: search for 'internmap' in Docker filesystem",
             "sudo find /var/lib/docker -iname '*internmap*' 2>/dev/null | head -20; echo '--- Verification complete ---'",
             use_sudo=True)

    except Exception as e:
        print(f"\n[!] Error: {e}")
        sys.exit(1)
    finally:
        client.close()
        print(f"\n{'#'*70}")
        print(f"  Deployment complete.")
        print(f"  Time: {datetime.now().isoformat()}")
        print(f"{'#'*70}")


if __name__ == "__main__":
    main()
