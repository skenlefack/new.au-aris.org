#!/usr/bin/env python3
"""
ARIS -- Deploy campaign display fix to staging
"""

import paramiko
import json
import time
import sys
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
    print(f"  ARIS -- Deploy Campaign Fix to Staging")
    print(f"  {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname="10.202.101.146", username=SSH_USER, password=SSH_PASS, timeout=15)
    print("  [+] Connected to staging (10.202.101.146)")

    # 1. Git pull
    step(client, 1, "Git pull",
         "cd /opt/aris && git pull origin main 2>&1")

    # 2. Copy compose and rebuild web
    step(client, 2, "Copy compose file",
         "cp /opt/aris/deploy/vm-app-stg/docker-compose.yml /opt/aris-deploy/vm-app-stg/docker-compose.yml && echo 'OK'")

    step(client, 3, "Rebuild and restart web container",
         "cd /opt/aris-deploy/vm-app-stg && docker compose up -d --no-deps --build web 2>&1",
         timeout=600)

    print("\n  Waiting 15s for web container to start...")
    time.sleep(15)

    # 4. Verify container
    step(client, 4, "Verify web container",
         "docker ps --filter name=aris-stg-web --format '{{.Names}} {{.Status}}'")

    # 5. Test the campaigns API
    print(f"\n{'='*70}")
    print(f"  5. Test campaigns API from web")
    print(f"{'='*70}")

    # Login
    from paramiko import SSHClient
    stdin, stdout, stderr = client.exec_command(
        """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login \
           -H 'Content-Type: application/json' \
           -d '{"email":"admin@au-aris.org","password":"Aris2024!"}' 2>&1""")
    login_out = stdout.read().decode("utf-8", errors="replace").strip()
    try:
        login_data = json.loads(login_out)
        token = login_data.get("data", {}).get("accessToken")
        if token:
            # Test workflow campaigns API
            out, err, code = run_sudo(client,
                f'curl -s https://localhost/api/v1/workflow/campaigns -H "Authorization: Bearer {token}" -k 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\\"Total: {{d.get(\'meta\',{{}}).get(\'total\',0)}} campaigns\\"); [print(f\\"  - {{c.get(\'code\')}} [{{c.get(\'status\')}}] {{c.get(\'domain\')}}\\") for c in d.get(\'data\',[])[:5]]" 2>&1')
            if out:
                print(out)
            else:
                print("  Could not parse response")
    except:
        print(f"  Login failed: {login_out[:100]}")

    # 6. Test page renders
    step(client, 6, "Test campaigns page loads",
         "curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:3100/collecte/campaigns 2>/dev/null")

    client.close()
    print(f"\n{'#'*70}")
    print(f"  Done -- {datetime.now().isoformat()}")
    print(f"{'#'*70}")


if __name__ == "__main__":
    main()
