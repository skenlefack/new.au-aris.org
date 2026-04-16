#!/usr/bin/env python3
"""
Deploy BI subdomain routing + dynamic roles to PROD and STAGING.

Services to rebuild:
- web (Next.js — new env vars + BI pages rewrite)
- tenant (bi.service.ts — Grafana embed URL from DB)
- superset (new SUPERSET_SCRIPT_NAME="" env)
- metabase (new MB_SITE_URL subdomain)
- grafana (new GF_SERVER_ROOT_URL subdomain, no sub-path)
"""
import paramiko
import sys
import time

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = {
    "prod": {
        "app_ip": "10.202.101.183",
        "compose_dir": "/opt/aris-deploy/vm-app",
        "compose_src": "deploy/vm-app/docker-compose.yml",
        "prefix": "aris",
    },
    "stg": {
        "app_ip": "10.202.101.146",
        "compose_dir": "/opt/aris-deploy/vm-app-stg",
        "compose_src": "deploy/vm-app-stg/docker-compose.yml",
        "prefix": "aris-stg",
    },
}

SERVICES_TO_REBUILD = ["web", "tenant", "superset", "metabase", "grafana"]


def sudo_cmd(cmd):
    """Wrap command with echo password | sudo -S."""
    return f"echo '{SSH_PASS}' | sudo -S {cmd}"


def ssh_exec(client, cmd, timeout=300):
    """Execute command and return (stdout, stderr, exit_code)."""
    print(f"  $ {cmd[:120]}{'...' if len(cmd) > 120 else ''}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    # Filter out sudo password prompt noise
    err_lines = [l for l in err.split("\n") if l and "[sudo]" not in l and "password" not in l.lower()]
    if out:
        lines = out.split("\n")
        if len(lines) > 30:
            print(f"    ({len(lines)} lines, showing last 15)")
            for line in lines[-15:]:
                print(f"    {line}")
        else:
            for line in lines:
                print(f"    {line}")
    if err_lines and exit_code != 0:
        for line in err_lines[:10]:
            print(f"    [ERR] {line}")
    return out, err, exit_code


def deploy_env(env_name, env_cfg):
    print(f"\n{'='*60}")
    print(f"  DEPLOYING TO {env_name.upper()} — {env_cfg['app_ip']}")
    print(f"{'='*60}\n")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        print(f"[1/6] Connecting to {env_cfg['app_ip']}...")
        client.connect(env_cfg["app_ip"], username=SSH_USER, password=SSH_PASS, timeout=15)
        print("  Connected!\n")

        # Step 2: Git pull (needs sudo for permission)
        print(f"[2/6] Git pull on /opt/aris...")
        out, err, rc = ssh_exec(client, sudo_cmd("git -C /opt/aris pull origin main"))
        if rc != 0:
            # Try fixing ownership first
            print("  Fixing git ownership...")
            ssh_exec(client, sudo_cmd("chown -R arisadmin:arisadmin /opt/aris/.git"))
            out, err, rc = ssh_exec(client, "cd /opt/aris && git pull origin main")
            if rc != 0:
                print(f"  WARNING: git pull returned {rc}, trying with sudo...")
                ssh_exec(client, sudo_cmd("git -C /opt/aris pull origin main"))
        print()

        # Step 3: Copy docker-compose.yml to deploy dir
        print(f"[3/6] Copying docker-compose.yml to {env_cfg['compose_dir']}...")
        ssh_exec(client, sudo_cmd(f"cp /opt/aris/{env_cfg['compose_src']} {env_cfg['compose_dir']}/docker-compose.yml"))
        print()

        # Step 4: Copy superset config
        print(f"[4/6] Copying superset_config.py...")
        # superset_config.py is mounted from /opt/aris/docker/superset/ — git pull already updated it
        ssh_exec(client, sudo_cmd("ls -la /opt/aris/docker/superset/superset_config.py"))
        print()

        # Step 5: Rebuild and restart services one by one
        print(f"[5/6] Rebuilding and restarting services...")
        compose_dir = env_cfg["compose_dir"]

        for svc in SERVICES_TO_REBUILD:
            print(f"\n  --- {svc} ---")
            cmd = sudo_cmd(f"docker compose -f {compose_dir}/docker-compose.yml up -d --build --no-deps {svc}")
            out, err, rc = ssh_exec(client, cmd, timeout=600)
            if rc != 0:
                print(f"  WARNING: {svc} returned exit code {rc}")
            else:
                print(f"  {svc} OK")

        print()

        # Step 6: Verify containers are running
        print(f"[6/6] Verifying containers...")
        prefix = env_cfg["prefix"]
        out, err, rc = ssh_exec(
            client,
            sudo_cmd(f"docker ps --filter 'name={prefix}-' --format '{{{{.Names}}}} {{{{.Status}}}}'")
        )

        for svc in SERVICES_TO_REBUILD:
            container = f"{prefix}-{svc}"
            if container in (out or ""):
                print(f"  {container}: RUNNING")
            else:
                print(f"  {container}: checking...")
                o2, _, _ = ssh_exec(client, sudo_cmd(f"docker ps -a --filter name={container} --format '{{{{.Names}}}} {{{{.Status}}}}'"))
                if "Up" in (o2 or ""):
                    print(f"  {container}: RUNNING")
                else:
                    print(f"  {container}: WARNING - check logs!")

        print(f"\n  {env_name.upper()} deployment complete!")

    except Exception as e:
        print(f"\n  ERROR: {e}")
        raise
    finally:
        client.close()


def main():
    envs_to_deploy = sys.argv[1:] if len(sys.argv) > 1 else ["stg", "prod"]

    print("=" * 60)
    print("  BI Subdomain Routing Deployment")
    print(f"  Environments: {', '.join(envs_to_deploy)}")
    print(f"  Services: {', '.join(SERVICES_TO_REBUILD)}")
    print("=" * 60)

    for env_name in envs_to_deploy:
        if env_name not in ENVS:
            print(f"Unknown environment: {env_name}")
            continue
        deploy_env(env_name, ENVS[env_name])

    print("\n" + "=" * 60)
    print("  ALL DEPLOYMENTS COMPLETE")
    print("=" * 60)
    print("\nVerify:")
    print("  PROD: https://superset.au-aris.org  https://metabase.au-aris.org  https://grafana.au-aris.org")
    print("  STG:  https://superset-test.au-aris.org  https://metabase-test.au-aris.org  https://grafana-test.au-aris.org")
    print("  Web:  https://au-aris.org/bi-tools  https://test.au-aris.org/bi-tools")


if __name__ == "__main__":
    main()
