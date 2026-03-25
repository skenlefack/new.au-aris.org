#!/usr/bin/env python3
"""
ARIS -- Check why 21 campaigns created on staging don't display
"""

import paramiko
import json
import sys
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

STG_APP = "10.202.101.146"
STG_DB = "10.202.101.148"


def run_sudo(client, cmd, timeout=30):
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


def run(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return out, err, code


def connect(ip):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=ip, username=SSH_USER, password=SSH_PASS, timeout=15)
    return client


def step(client, num, title, cmd, sudo=True, timeout=30):
    print(f"\n{'='*70}")
    print(f"  {num}. {title}")
    print(f"{'='*70}")
    if sudo:
        out, err, code = run_sudo(client, cmd, timeout=timeout)
    else:
        out, err, code = run(client, cmd, timeout=timeout)
    if out:
        lines = out.split("\n")
        if len(lines) > 50:
            print("\n".join(lines[:25]))
            print(f"  ... ({len(lines) - 50} lines omitted) ...")
            print("\n".join(lines[-25:]))
        else:
            print(out)
    if err and len(err) > 10:
        print(f"  [STDERR] {err[:500]}")
    status = "OK" if code == 0 else f"EXIT {code}"
    print(f"  [{status}]")
    return out, code


def main():
    print(f"{'#'*70}")
    print(f"  ARIS -- Check Campaigns on Staging")
    print(f"  {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    app = connect(STG_APP)

    # 1. Check collecte and workflow service status
    step(app, 1, "Collecte + Workflow container status",
         "docker ps -a --filter 'name=aris-stg-collecte' --filter 'name=aris-stg-workflow' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")

    # 2. Check collecte service logs
    step(app, 2, "Collecte service logs (last 30 lines)",
         "docker logs aris-stg-collecte --tail 30 2>&1")

    # 3. Check workflow service logs
    step(app, 3, "Workflow service logs (last 30 lines)",
         "docker logs aris-stg-workflow --tail 30 2>&1")

    # 4. Get auth token for API testing
    print(f"\n{'='*70}")
    print(f"  4. Login to get auth token")
    print(f"{'='*70}")
    login_out, _, _ = run(app,
        """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login \
           -H 'Content-Type: application/json' \
           -d '{"email":"admin@au-aris.org","password":"Aris2024!"}' 2>&1""")
    token = None
    if login_out:
        try:
            login_data = json.loads(login_out)
            token = login_data.get("data", {}).get("accessToken") or login_data.get("accessToken")
            if token:
                print(f"  Got token: {token[:30]}...")
            else:
                print(f"  Login response: {login_out[:200]}")
        except:
            print(f"  Login response (not JSON): {login_out[:200]}")

    # 5. Test campaign list API (collecte service)
    if token:
        step(app, 5, "API: GET /api/v1/collecte/campaigns (direct port 3011)",
             f"""curl -s http://localhost:3011/api/v1/collecte/campaigns \
                -H 'Authorization: Bearer {token}' 2>&1 | head -200""",
             sudo=False)

        # 6. Test via Traefik
        step(app, 6, "API: GET /api/v1/collecte/campaigns (via Traefik HTTPS)",
             f"""curl -sk https://localhost/api/v1/collecte/campaigns \
                -H 'Authorization: Bearer {token}' 2>&1 | head -200""",
             sudo=False)

        # 7. Test workflow campaigns
        step(app, 7, "API: GET /api/v1/workflow/campaigns (direct port 3012)",
             f"""curl -s http://localhost:3012/api/v1/workflow/campaigns \
                -H 'Authorization: Bearer {token}' 2>&1 | head -200""",
             sudo=False)

        # 8. Test via Traefik
        step(app, 8, "API: GET /api/v1/workflow/campaigns (via Traefik HTTPS)",
             f"""curl -sk https://localhost/api/v1/workflow/campaigns \
                -H 'Authorization: Bearer {token}' 2>&1 | head -200""",
             sudo=False)
    else:
        print("\n  [!] No auth token - skipping API tests")

    # 9. Check Traefik routing for collecte/workflow
    step(app, 9, "Traefik routing rules for collecte/workflow",
         "docker exec aris-stg-traefik cat /etc/traefik/traefik.yml 2>/dev/null; echo '---DYNAMIC---'; docker exec aris-stg-traefik ls /etc/traefik/ 2>/dev/null")

    app.close()

    # 10. Check DB directly for campaigns
    print(f"\n{'='*70}")
    print(f"  10. Query campaigns directly from staging DB")
    print(f"{'='*70}")
    try:
        db = connect(STG_DB)

        # List all schemas
        out, err, code = run_sudo(db,
            'docker exec aris-stg-postgresql psql -U aris -d aris -t -A -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN (\'pg_catalog\', \'information_schema\', \'pg_toast\') ORDER BY schema_name;" 2>&1',
            timeout=15)
        if out:
            schemas = [s.strip() for s in out.split("\n") if s.strip()]
            print(f"  Schemas: {', '.join(schemas)}")

        # Search for campaign tables across all schemas
        out2, err2, code2 = run_sudo(db,
            'docker exec aris-stg-postgresql psql -U aris -d aris -t -A -c "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE \'%campaign%\' ORDER BY table_schema, table_name;" 2>&1',
            timeout=15)
        if out2:
            print(f"\n  Campaign tables found:")
            for line in out2.split("\n"):
                if line.strip():
                    print(f"    {line}")
        else:
            print(f"  No tables matching 'campaign' found")

        # Count campaigns in each table
        if out2:
            for line in out2.split("\n"):
                if "|" in line:
                    parts = line.split("|")
                    schema = parts[0].strip()
                    table = parts[1].strip()
                    count_out, _, _ = run_sudo(db,
                        f'docker exec aris-stg-postgresql psql -U aris -d aris -t -A -c "SELECT COUNT(*) FROM {schema}.{table};" 2>&1',
                        timeout=10)
                    print(f"\n  {schema}.{table}: {count_out.strip()} rows")

                    # Show recent campaigns
                    rows_out, _, _ = run_sudo(db,
                        f'docker exec aris-stg-postgresql psql -U aris -d aris -c "SELECT id, title, status, created_at FROM {schema}.{table} ORDER BY created_at DESC LIMIT 10;" 2>&1',
                        timeout=10)
                    if rows_out:
                        # Filter out sudo noise
                        clean = "\n".join(l for l in rows_out.split("\n") if "[sudo]" not in l and "password" not in l.lower())
                        print(clean[:1000])

        db.close()
    except Exception as e:
        print(f"  [!] DB check failed: {e}")

    print(f"\n{'#'*70}")
    print(f"  Done -- {datetime.now().isoformat()}")
    print(f"{'#'*70}")


if __name__ == "__main__":
    main()
