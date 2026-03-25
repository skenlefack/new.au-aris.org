#!/usr/bin/env python3
"""
ARIS -- Fix domain display Part 2
- Verify staging fix
- Deploy to production
"""

import paramiko
import json
import time
import sys
from datetime import datetime

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


def run(client, cmd, timeout=60):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return out, err, code


def step(client, num, title, cmd, sudo=True, timeout=300):
    print(f"\n{'='*70}")
    print(f"  STEP {num} -- {title}")
    print(f"{'='*70}")
    if sudo:
        out, err, code = run_sudo(client, cmd, timeout=timeout)
    else:
        out, err, code = run(client, cmd, timeout=timeout)
    if out:
        lines = out.split("\n")
        if len(lines) > 40:
            print("\n".join(lines[:20]))
            print(f"  ... ({len(lines) - 40} lines omitted) ...")
            print("\n".join(lines[-20:]))
        else:
            print(out)
    if err and len(err) > 10:
        print(f"  [STDERR] {err[:300]}")
    status = "OK" if code == 0 else f"EXIT {code}"
    print(f"  [{status}]")
    return out, code


def connect(ip, label):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=ip, username=SSH_USER, password=SSH_PASS, timeout=15)
    print(f"  [{label}] Connected to {ip}")
    return client


def main():
    print(f"{'#'*70}")
    print(f"  ARIS -- Fix Domain Display Part 2")
    print(f"  {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    # == STAGING VERIFICATION ==
    print(f"\n\n{'*'*70}")
    print(f"  STAGING -- Verify fix")
    print(f"{'*'*70}")

    stg = connect("10.202.101.146", "STAGING")

    # Test web->tenant connectivity from container
    step(stg, "1/3", "Test web->tenant connectivity from container",
         "docker exec aris-stg-web wget -qO- http://tenant:3001/api/v1/public/domains 2>&1 | head -200")

    # Check rendered HTML
    step(stg, "2/3", "Check rendered HTML for DB descriptions",
         """
RESPONSE=$(curl -s http://localhost:3100/ 2>/dev/null)
if echo "$RESPONSE" | grep -q "Disease surveillance, outbreak management"; then
    echo "SUCCESS: HTML contains FULL DB descriptions"
elif echo "$RESPONSE" | grep -q "Surveillance, outbreaks, AMR"; then
    echo "PENDING: HTML still has fallback (ISR cache needs ~5 min to refresh)"
else
    echo "WARNING: No domain descriptions found"
fi
echo ""
echo "Description samples from HTML:"
echo "$RESPONSE" | grep -oP '"description":\\{"en":"[^"]+' | head -5
""")

    # Force ISR revalidation by hitting the page a few times
    step(stg, "3/3", "Trigger ISR revalidation",
         """
for i in 1 2 3; do
    curl -s -o /dev/null -w "Request $i: HTTP %{http_code}\\n" http://localhost:3100/
    sleep 2
done
echo ""
echo "After ISR trigger:"
RESPONSE=$(curl -s http://localhost:3100/ 2>/dev/null)
echo "$RESPONSE" | grep -oP '"description":\\{"en":"[^"]+' | head -5
""")

    stg.close()

    # == PRODUCTION ==
    print(f"\n\n{'*'*70}")
    print(f"  PRODUCTION -- Deploy fix")
    print(f"{'*'*70}")

    prod = connect("10.202.101.183", "PRODUCTION")

    step(prod, "1/5", "Git pull on production",
         "cd /opt/aris && git pull origin main 2>&1")

    step(prod, "2/5", "Copy docker-compose.yml to production deploy dir",
         "cp /opt/aris/deploy/vm-app/docker-compose.yml /opt/aris-deploy/vm-app/docker-compose.yml && echo 'Copied OK'")

    step(prod, "3/5", "Recreate aris-web with new env var",
         "cd /opt/aris-deploy/vm-app && docker compose up -d --no-deps --build web 2>&1",
         timeout=600)

    print("\n  Waiting 15s for web container to start...")
    time.sleep(15)

    step(prod, "4/5", "Verify env var and container status",
         """
docker exec aris-web env 2>&1 | grep -i TENANT
echo "---"
docker ps --filter name=aris-web --format '{{.Names}} {{.Status}}'
""")

    step(prod, "5/5", "Verify domains in rendered HTML",
         """
RESPONSE=$(curl -s http://localhost:3100/ 2>/dev/null)
if echo "$RESPONSE" | grep -q "Disease surveillance, outbreak management"; then
    echo "SUCCESS: HTML contains FULL DB descriptions"
elif echo "$RESPONSE" | grep -q "Surveillance, outbreaks, AMR"; then
    echo "PENDING: ISR cache refresh needed (~5 min)"
else
    echo "WARNING: No domain descriptions found"
fi
echo ""
echo "Description samples:"
echo "$RESPONSE" | grep -oP '"description":\\{"en":"[^"]+' | head -5
""")

    prod.close()

    print(f"\n{'#'*70}")
    print(f"  Done -- {datetime.now().isoformat()}")
    print(f"{'#'*70}")


if __name__ == "__main__":
    main()
