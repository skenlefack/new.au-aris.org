#!/usr/bin/env python3
"""
ARIS -- Deploy campaign display fix to staging (attempt 2)
Fix: add explicit type annotation to campaign map callback
"""

import paramiko
import sys
import time
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"


def run_sudo(client, cmd, timeout=300):
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


def step(client, num, title, cmd, timeout=300):
    print(f"\n{'='*70}")
    print(f"  {num}. {title}")
    print(f"{'='*70}")
    out, err, code = run_sudo(client, cmd, timeout=timeout)
    if out:
        lines = out.split("\n")
        if len(lines) > 40:
            print("\n".join(lines[:15]))
            print(f"  ... ({len(lines) - 30} lines omitted) ...")
            print("\n".join(lines[-15:]))
        else:
            print(out)
    if err and len(err) > 10:
        print(f"  [STDERR] {err[:300]}")
    status = "OK" if code == 0 else f"EXIT {code}"
    print(f"  [{status}]")
    return out, code


def main():
    print(f"{'#'*70}")
    print(f"  ARIS -- Deploy Campaign Fix v2 to Staging")
    print(f"  {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname="10.202.101.146", username=SSH_USER, password=SSH_PASS, timeout=15)
    print("  [+] Connected to staging (10.202.101.146)")

    # 1. Git pull
    step(client, 1, "Git pull",
         "cd /opt/aris && git pull origin main 2>&1")

    # 2. Copy compose file
    step(client, 2, "Copy compose file",
         "cp /opt/aris/deploy/vm-app-stg/docker-compose.yml /opt/aris-deploy/vm-app-stg/docker-compose.yml && echo OK")

    # 3. Rebuild web container
    out, code = step(client, 3, "Rebuild and restart web container",
         "cd /opt/aris-deploy/vm-app-stg && docker compose up -d --no-deps --build web 2>&1 | tail -40",
         timeout=600)

    if code != 0:
        print("\n  [!] Build FAILED -- getting detailed error...")
        step(client, "3b", "Full build error",
             "cd /opt/aris-deploy/vm-app-stg && docker compose build web 2>&1 | tail -30",
             timeout=600)
    else:
        print("\n  Waiting 15s for web container to start...")
        time.sleep(15)

        # 4. Verify container
        step(client, 4, "Verify web container",
             "docker ps --filter name=aris-stg-web --format '{{.Names}} {{.Status}}'")

        # 5. Test campaigns page
        step(client, 5, "Test campaigns page",
             "curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:3100/collecte/campaigns 2>/dev/null")

    client.close()
    print(f"\n{'#'*70}")
    print(f"  Done -- {datetime.now().isoformat()}")
    print(f"{'#'*70}")


if __name__ == "__main__":
    main()
