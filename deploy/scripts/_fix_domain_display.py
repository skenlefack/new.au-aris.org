#!/usr/bin/env python3
"""
ARIS — Fix domain display on staging and production
Problem: Staging web container can't reach tenant API because
  http://aris-tenant:3001 doesn't resolve (container is aris-stg-tenant).
Fix: Add INTERNAL_TENANT_URL=http://tenant:3001 to web container env.

Steps:
1. Git pull (gets updated docker-compose.yml)
2. Copy compose files to deploy dirs
3. Restart web container on staging
4. Restart web container on production (for safety)
5. Verify domains come from API, not fallback
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
    print(f"  STEP {num} — {title}")
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
    print(f"  ARIS -- Fix Domain Display (web->tenant connectivity)")
    print(f"  {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    # ── STAGING ──
    print(f"\n\n{'*'*70}")
    print(f"  STAGING ENVIRONMENT")
    print(f"{'*'*70}")

    stg = connect("10.202.101.146", "STAGING")

    # 1. Git pull
    step(stg, "1/6", "Git pull on staging",
         "cd /opt/aris && git pull origin main 2>&1")

    # 2. Copy compose file to deploy dir
    step(stg, "2/6", "Copy docker-compose.yml to staging deploy dir",
         "cp /opt/aris/deploy/vm-app-stg/docker-compose.yml /opt/aris-deploy/vm-app-stg/docker-compose.yml && echo 'Copied OK'")

    # 3. Recreate web container (picks up new env var)
    step(stg, "3/6", "Recreate aris-stg-web with new env var",
         "cd /opt/aris-deploy/vm-app-stg && docker compose up -d --no-deps --build web 2>&1",
         timeout=600)

    # Wait for container to start
    print("\n  Waiting 15s for web container to start...")
    time.sleep(15)

    # 4. Verify env var is set
    step(stg, "4/6", "Verify INTERNAL_TENANT_URL env var",
         "docker exec aris-stg-web env 2>&1 | grep -i TENANT")

    # 5. Test web→tenant connectivity from inside container
    step(stg, "5/6", "Test web→tenant connectivity",
         "docker exec aris-stg-web wget -qO- http://tenant:3001/api/v1/public/domains 2>&1 | head -200")

    # 6. Check HTML for real descriptions (not fallback)
    step(stg, "6/6", "Verify domains in rendered HTML use DB descriptions",
         r"""
RESPONSE=$(curl -s http://localhost:3100/ 2>/dev/null)
# Check for a full DB description (not the short fallback)
if echo "$RESPONSE" | grep -q "Disease surveillance, outbreak management"; then
    echo "SUCCESS: HTML contains DB descriptions (from API)"
elif echo "$RESPONSE" | grep -q "Surveillance, outbreaks, AMR"; then
    echo "WARNING: HTML still contains FALLBACK descriptions (not from API)"
    echo "  This may take up to 5 minutes for ISR to revalidate"
else
    echo "WARNING: No domain descriptions found in HTML"
fi
echo ""
echo "Description samples from HTML:"
echo "$RESPONSE" | grep -oP 'description\":\{\"en\":\"[^"]+' | head -5
""")

    stg.close()

    # ── PRODUCTION ──
    print(f"\n\n{'*'*70}")
    print(f"  PRODUCTION ENVIRONMENT")
    print(f"{'*'*70}")

    prod = connect("10.202.101.183", "PRODUCTION")

    # 1. Git pull
    step(prod, "1/4", "Git pull on production",
         "cd /opt/aris && git pull origin main 2>&1")

    # 2. Copy compose file
    step(prod, "2/4", "Copy docker-compose.yml to production deploy dir",
         "cp /opt/aris/deploy/vm-app/docker-compose.yml /opt/aris-deploy/vm-app/docker-compose.yml && echo 'Copied OK'")

    # 3. Recreate web container
    step(prod, "3/4", "Recreate aris-web with new env var",
         "cd /opt/aris-deploy/vm-app && docker compose up -d --no-deps --build web 2>&1",
         timeout=600)

    print("\n  Waiting 15s for web container to start...")
    time.sleep(15)

    # 4. Verify
    step(prod, "4/4", "Verify domains in rendered HTML",
         r"""
docker exec aris-web env 2>&1 | grep -i TENANT
echo "---"
RESPONSE=$(curl -s http://localhost:3100/ 2>/dev/null)
if echo "$RESPONSE" | grep -q "Disease surveillance, outbreak management"; then
    echo "SUCCESS: HTML contains DB descriptions (from API)"
else
    echo "WARNING: May need ISR revalidation (up to 5 min)"
fi
echo ""
echo "Description samples:"
echo "$RESPONSE" | grep -oP 'description\":\{\"en\":\"[^"]+' | head -5
""")

    prod.close()

    print(f"\n{'#'*70}")
    print(f"  Done — {datetime.now().isoformat()}")
    print(f"  Note: If HTML still shows fallback data, wait 5 min for ISR cache to refresh")
    print(f"{'#'*70}")


if __name__ == "__main__":
    main()
