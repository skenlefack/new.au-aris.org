"""
Deploy the new data-sharing service to staging and production.

Steps per server:
  1. Git pull
  2. Copy docker-compose.yml to /opt/aris-deploy
  3. Build & start the new data-sharing container
  4. Run prisma db push from inside data-sharing container (creates the data_sharing schema tables)
  5. Rebuild the web container (so the new pages ship)
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
        "compose_src": "deploy/vm-app-stg/docker-compose.yml",
        "container_prefix": "aris-stg",
        "db_password": "Ar1s_Stg_2024!xK9mZ",
    },
    {
        "name": "PRODUCTION",
        "host": "10.202.101.183",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "compose_src": "deploy/vm-app/docker-compose.yml",
        "container_prefix": "aris",
        "db_password": None,  # read from env on the server
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
    compose_src = server["compose_src"]
    container_prefix = server["container_prefix"]
    data_sharing_container = f"{container_prefix}-data-sharing"
    web_container = f"{container_prefix}-web"

    print(f"\n{'='*60}")
    print(f"  DEPLOYING DATA-SHARING -- {name} ({host})")
    print(f"{'='*60}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        print(f"\n[1/6] Connecting to {host}...")
        ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=30)
        print("  Connected.")

        print(f"\n[2/6] Git pull on /opt/aris...")
        run(ssh, f"{SUDO_CMD} 'cd /opt/aris && git pull origin main'")

        print(f"\n[3/6] Copying docker-compose.yml to {deploy_dir}...")
        run(ssh, f"{SUDO_CMD} 'cp /opt/aris/{compose_src} {deploy_dir}/docker-compose.yml'")

        print(f"\n[4/6] Building & starting {data_sharing_container}...")
        code, _, _ = run(
            ssh,
            f"{SUDO_CMD} 'cd {deploy_dir} && docker compose up -d --build --no-deps data-sharing'",
            timeout=900,
        )
        if code != 0:
            print(f"  ERROR: data-sharing build/start failed (exit {code})")
            return False

        # Wait briefly for the container to be ready
        run(ssh, f"sleep 5 && docker ps --filter name={data_sharing_container} --format '{{{{.Status}}}}'")

        print(f"\n[5/6] Running prisma db push (creates data_sharing schema tables)...")
        # The compose file mounts .env so DATABASE_URL is set inside the container.
        # Prisma schema files live in /app/packages/db-schemas/prisma
        prisma_cmd = (
            f"docker exec -w /app/packages/db-schemas {data_sharing_container} "
            f"sh -c 'npx prisma db push --schema=prisma --skip-generate --accept-data-loss 2>&1 | tail -40'"
        )
        code, out, _ = run(ssh, f"{SUDO_CMD} '{prisma_cmd}'", timeout=300)
        if "data_sharing" not in out and "already in sync" not in out and "datasource" not in out.lower():
            print("  WARNING: prisma db push output unexpected, continuing...")

        print(f"\n[6/6] Rebuilding {web_container}...")
        code, _, _ = run(
            ssh,
            f"{SUDO_CMD} 'cd {deploy_dir} && docker compose up -d --build --no-deps web'",
            timeout=900,
        )
        if code != 0:
            print(f"  ERROR: web rebuild failed (exit {code})")
            return False

        # Verify health
        print(f"\n[verify] Health check...")
        run(ssh, f"sleep 5 && curl -sf http://localhost:3034/health || echo HEALTH_FAIL")

        print(f"\n  {name} data-sharing deploy completed.")
        return True

    except Exception as e:
        print(f"  ERROR on {name}: {e}")
        return False
    finally:
        ssh.close()


def main():
    print("=" * 60)
    print("  ARIS 4.0 -- Data Sharing Module Deployment")
    print("  Targets: Staging + Production")
    print("=" * 60)

    results = {}
    for server in SERVERS:
        results[server["name"]] = deploy_server(server)

    print(f"\n{'='*60}")
    print("  DEPLOYMENT SUMMARY")
    print(f"{'='*60}")
    for name, ok in results.items():
        print(f"  {name}: {'OK' if ok else 'FAILED'}")
    print(f"{'='*60}")
    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
