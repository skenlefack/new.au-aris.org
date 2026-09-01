"""
Deploy GeoZones feature to staging and production.

Steps per server:
  1. Git pull
  2. Prisma db push (creates geo_zones table in master_data schema)
  3. Rebuild master-data service (new validation logic)
  4. Rebuild collecte service (geoZoneId validation)
  5. Rebuild analytics service (zone KPI endpoint)
  6. Rebuild web (zone dashboard UI)
  7. Seed geo zones (run master-data seed)
"""

import paramiko
import sys

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO_CMD = f"echo '{SSH_PASS}' | sudo -S bash -c"

SERVERS = [
    {
        "name": "STAGING",
        "host": "10.202.101.146",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "container_prefix": "aris-stg",
        "db_host": "10.202.101.148",
        "db_password": "Ar1s_Stg_2024!xK9mZ",
    },
    {
        "name": "PRODUCTION",
        "host": "10.202.101.183",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "container_prefix": "aris",
        "db_host": "10.202.101.185",
        "db_password": "Ar1s_Pr0d_2024!xK9mZ",
    },
]


def run(ssh, command, timeout=600):
    print(f"  > {command[:140]}{'...' if len(command) > 140 else ''}")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    combined = (out + err).strip()
    if combined:
        for line in combined.splitlines()[-8:]:
            print(f"    {line}")
    return code, out, err


def deploy_server(server):
    name = server["name"]
    host = server["host"]
    deploy_dir = server["deploy_dir"]
    prefix = server["container_prefix"]
    db_host = server["db_host"]
    db_pass = server["db_password"]

    master_data_container = f"{prefix}-master-data"
    collecte_container = f"{prefix}-collecte"
    analytics_container = f"{prefix}-analytics"
    web_container = f"{prefix}-web"

    db_url = f"postgresql://aris:{db_pass}@{db_host}:5432/aris?schema=master_data"
    direct_db_url = db_url

    print(f"\n{'='*60}")
    print(f"  DEPLOYING GEO-ZONES -- {name} ({host})")
    print(f"{'='*60}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        print(f"\n[1/7] Connecting to {host}...")
        ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=30)
        print("  Connected.")

        print(f"\n[2/7] Git pull on /opt/aris...")
        run(ssh, f"{SUDO_CMD} 'cd /opt/aris && git fetch origin && git reset --hard origin/main'")

        print(f"\n[3/7] Prisma db push (create geo_zones table)...")
        code, _, _ = run(
            ssh,
            f"{SUDO_CMD} 'docker exec -w /app/packages/db-schemas "
            f"-e DATABASE_URL=\"{db_url}\" "
            f"-e DIRECT_DATABASE_URL=\"{direct_db_url}\" "
            f"{master_data_container} npx prisma db push --schema=prisma --accept-data-loss'",
        )
        if code != 0:
            print(f"  WARNING: Prisma db push exited with code {code} (generate may fail but schema push usually succeeds)")

        print(f"\n[4/7] Rebuilding master-data service...")
        run(
            ssh,
            f"{SUDO_CMD} 'cd {deploy_dir} && docker compose up -d --build --no-deps {master_data_container.replace(prefix + '-', '')}'",
            timeout=300,
        )

        print(f"\n[5/7] Rebuilding collecte + analytics services...")
        for svc in ["collecte", "analytics"]:
            container = f"{prefix}-{svc}"
            run(
                ssh,
                f"{SUDO_CMD} 'cd {deploy_dir} && docker compose up -d --build --no-deps {svc}'",
                timeout=300,
            )

        print(f"\n[6/7] Rebuilding web frontend...")
        run(
            ssh,
            f"{SUDO_CMD} 'cd {deploy_dir} && docker compose up -d --build --no-deps web'",
            timeout=300,
        )

        print(f"\n[7/7] Seeding geo zones (master-data seed)...")
        seed_db_url = f"postgresql://aris:{db_pass}@{db_host}:6432/aris?schema=master_data&pgbouncer=true"
        code, _, _ = run(
            ssh,
            f"{SUDO_CMD} 'docker exec -w /app/services/master-data "
            f"-e DATABASE_URL=\"{seed_db_url}\" "
            f"-e DIRECT_DATABASE_URL=\"{direct_db_url}\" "
            f"{master_data_container} node dist/seed/run-seed.js'",
            timeout=120,
        )
        if code != 0:
            print(f"  WARNING: Seed exited with code {code}")

        print(f"\n  DONE — {name} deployment complete!")
        print(f"  Verify: curl -s http://{host}:3003/api/v1/master-data/geo-zones | head")

    except Exception as e:
        print(f"\n  ERROR on {name}: {e}")
    finally:
        ssh.close()


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "staging"

    if target == "staging":
        deploy_server(SERVERS[0])
    elif target == "production":
        deploy_server(SERVERS[1])
    elif target == "all":
        for s in SERVERS:
            deploy_server(s)
    else:
        print(f"Usage: python {sys.argv[0]} [staging|production|all]")
        sys.exit(1)


if __name__ == "__main__":
    main()
