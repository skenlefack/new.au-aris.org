#!/usr/bin/env python3
"""
Deploy access-levels feature to PROD and STAGING.

Services rebuilt: web, tenant, collecte, analytics
Also: prisma db push for 3 new tables
"""

import sys
import time
import paramiko

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO = f"echo '{SSH_PASS}' | sudo -S bash -c"

PROD = {
    "name": "PROD",
    "host": "10.202.101.183",
    "deploy_dir": "/opt/aris-deploy/vm-app",
    "git_dir": "/opt/aris",
    "container_prefix": "aris",
    "db_host": "10.202.101.185",
    "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
}

STG = {
    "name": "STAGING",
    "host": "10.202.101.146",
    "deploy_dir": "/opt/aris-deploy/vm-app-stg",
    "git_dir": "/opt/aris",
    "container_prefix": "aris-stg",
    "db_host": "10.202.101.148",
    "db_pass": "Ar1s_Stg_2024!xK9mZ",
}

SERVICES = ["tenant", "collecte", "analytics", "web"]


def ssh_exec(client, cmd, timeout=120):
    """Execute command and return (stdout, stderr, exit_code)."""
    print(f"  $ {cmd[:120]}{'...' if len(cmd) > 120 else ''}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    code = stdout.channel.recv_exit_status()
    if out:
        for line in out.split("\n")[-5:]:
            print(f"    {line}")
    if code != 0 and err:
        for line in err.split("\n")[-3:]:
            print(f"    [ERR] {line}")
    return out, err, code


def connect(host):
    """Create SSH connection."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)
        print(f"  Connected to {host}")
        return client
    except Exception as e:
        print(f"  FAILED to connect to {host}: {e}")
        return None


def deploy(env):
    """Deploy to a single environment."""
    print(f"\n{'='*60}")
    print(f"  DEPLOYING TO {env['name']}")
    print(f"{'='*60}")

    client = connect(env["host"])
    if not client:
        return False

    try:
        # Phase 1: Git pull
        print(f"\n[1/4] Git pull on {env['name']}...")
        ssh_exec(client, f"{SUDO} 'cd {env['git_dir']} && git fetch origin && git reset --hard origin/main'")

        # Phase 2: Prisma db push (create new tables)
        print(f"\n[2/4] Prisma db push (3 new tables)...")
        db_url = f"postgresql://aris:{env['db_pass']}@{env['db_host']}:5432/aris"
        # Use any service container that has prisma
        container = f"{env['container_prefix']}-tenant"
        ssh_exec(
            client,
            f"{SUDO} 'docker exec -w /app/packages/db-schemas -e DATABASE_URL=\"{db_url}\" {container} npx prisma db push --schema=prisma --accept-data-loss 2>&1 | tail -10'",
            timeout=180,
        )

        # Phase 3: Rebuild services
        print(f"\n[3/4] Rebuilding services: {', '.join(SERVICES)}...")
        for svc in SERVICES:
            print(f"\n  --- {svc} ---")
            ssh_exec(
                client,
                f"{SUDO} 'cd {env['deploy_dir']} && docker compose up -d --build --force-recreate --no-deps {svc}'",
                timeout=300,
            )
            time.sleep(2)

        # Phase 4: Health check
        print(f"\n[4/4] Health check...")
        ssh_exec(client, f"{SUDO} 'docker ps --format \"table {{{{.Names}}}}\\t{{{{.Status}}}}\" | grep -E \"tenant|collecte|analytics|web\" | head -10'")

        print(f"\n  {env['name']} deployment COMPLETE")
        return True

    except Exception as e:
        print(f"\n  {env['name']} deployment FAILED: {e}")
        return False
    finally:
        client.close()


if __name__ == "__main__":
    targets = sys.argv[1:] if len(sys.argv) > 1 else ["prod", "stg"]

    results = {}
    for target in targets:
        if target.lower() in ("prod", "production"):
            results["PROD"] = deploy(PROD)
        elif target.lower() in ("stg", "staging"):
            results["STAGING"] = deploy(STG)
        else:
            print(f"Unknown target: {target}")

    print(f"\n{'='*60}")
    print("  DEPLOYMENT SUMMARY")
    print(f"{'='*60}")
    for env_name, success in results.items():
        status = "OK" if success else "FAILED"
        print(f"  {env_name}: {status}")
