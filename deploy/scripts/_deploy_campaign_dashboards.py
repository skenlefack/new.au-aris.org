#!/usr/bin/env python3
"""
Deploy campaign dashboard feature:
1. Add campaign_id column to dashboard_builder.dashboards
2. Link existing PPR dashboard to the Surveillance campaign
3. Deploy analytics + web services
"""
import paramiko
import sys
import time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO = f"echo '{SSH_PASS}' | sudo -S bash -c"

# PPR Dashboard ID (deterministic UUID from _create_ppr_dashboard.py)
PPR_DASHBOARD_ID = "a68e2cdf-4d5e-5a0d-9571-6d8f6b99e1d6"

SERVERS = [
    {
        "name": "PROD",
        "host": "10.202.101.183",
        "db_host": "10.202.101.185",
        "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
        "deploy_dir": "/opt/aris-deploy/vm-app",
    },
    {
        "name": "STG",
        "host": "10.202.101.146",
        "db_host": "10.202.101.148",
        "db_pass": "Ar1s_Stg_2024!xK9mZ",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
    },
]


def run_command(client, cmd, timeout=120):
    chan = client.get_transport().open_session()
    chan.settimeout(timeout)
    chan.exec_command(cmd)
    output = b""
    while True:
        try:
            chunk = chan.recv(4096)
            if not chunk:
                break
            output += chunk
        except:
            break
    stderr = b""
    while True:
        try:
            chunk = chan.recv_stderr(4096)
            if not chunk:
                break
            stderr += chunk
        except:
            break
    exit_code = chan.recv_exit_status()
    chan.close()
    return output.decode("utf-8", errors="replace"), stderr.decode("utf-8", errors="replace"), exit_code


def run_sql(client, db_host, db_pass, sql):
    """Run SQL via docker psql."""
    escaped_sql = sql.replace("'", "'\\''")
    cmd = (
        f"echo '{SSH_PASS}' | sudo -S docker run --rm --network host "
        f"-e PGPASSWORD={db_pass} postgres:16 "
        f"psql -h {db_host} -p 5432 -U aris -d aris -t -A -c '{escaped_sql}'"
    )
    out, err, code = run_command(client, cmd, timeout=30)
    return (out + err).strip()


def deploy(server):
    name = server["name"]
    host = server["host"]
    db_host = server["db_host"]
    db_pass = server["db_pass"]
    deploy_dir = server["deploy_dir"]

    print(f"\n{'='*60}")
    print(f"  {name} ({host})")
    print(f"{'='*60}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        print(f"  Connecting...")
        client.connect(host, username=SSH_USER, password=SSH_PASS, timeout=30)

        # Step 1: Add campaign_id column (idempotent)
        print(f"  [1/4] Adding campaign_id column...")
        result = run_sql(client, db_host, db_pass,
            "ALTER TABLE dashboard_builder.dashboards ADD COLUMN IF NOT EXISTS campaign_id UUID")
        print(f"    {result or 'OK'}")

        # Create index
        result = run_sql(client, db_host, db_pass,
            "CREATE INDEX IF NOT EXISTS idx_dashboard_campaign_id ON dashboard_builder.dashboards (campaign_id)")
        print(f"    Index: {result or 'OK'}")

        # Step 2: Find surveillance campaign and link PPR dashboard
        print(f"  [2/4] Linking PPR dashboard to surveillance campaign...")
        campaign_id = run_sql(client, db_host, db_pass,
            "SELECT id FROM collection_campaigns WHERE name::text LIKE '%Surveillance%Outil%' LIMIT 1")
        if campaign_id and len(campaign_id) == 36:
            print(f"    Campaign found: {campaign_id[:8]}...")
            result = run_sql(client, db_host, db_pass,
                f"UPDATE dashboard_builder.dashboards SET campaign_id = '{campaign_id}' WHERE id = '{PPR_DASHBOARD_ID}'")
            print(f"    Link: {result or 'OK'}")
        else:
            print(f"    Campaign not found — skipping link")

        # Step 3: git pull
        print(f"  [3/4] Git pull...")
        out, err, code = run_command(client,
            f"{SUDO} 'cd /opt/aris && git fetch origin && git reset --hard origin/main'",
            timeout=120)
        lines = (out + err).strip().split("\n")
        for line in lines[-3:]:
            print(f"    {line}")

        # Step 4: Rebuild analytics + web
        print(f"  [4/4] Rebuilding analytics + web...")
        out, err, code = run_command(client,
            f"{SUDO} 'cd {deploy_dir} && docker compose up -d --build --force-recreate --no-deps analytics web'",
            timeout=600)
        lines = (out + err).strip().split("\n")
        for line in lines[-8:]:
            print(f"    {line}")

        if code != 0:
            print(f"  ERROR: docker compose exited with code {code}")
            return False

        print(f"  {name} DONE")
        return True

    except Exception as e:
        print(f"  FAILED: {e}")
        return False
    finally:
        client.close()


if __name__ == "__main__":
    print("=" * 60)
    print("  CAMPAIGN DASHBOARDS — Schema + Deploy")
    print("=" * 60)

    results = {}
    for server in SERVERS:
        results[server["name"]] = deploy(server)

    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    for name, ok in results.items():
        print(f"  {name}: {'OK' if ok else 'FAILED'}")
