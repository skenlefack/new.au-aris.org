#!/usr/bin/env python3
"""Deploy BI tools routing fixes to production and staging servers."""

import paramiko
import time
import sys
import io

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

SSH_USER = "arisadmin"
SSH_PASSWORD = "@u-1baR.0rg$U24"

SERVERS = [
    {
        "name": "PRODUCTION (VM-APP)",
        "host": "10.202.101.183",
        "git_dir": "/opt/aris",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "compose_src": "/opt/aris/deploy/vm-app/docker-compose.yml",
        "compose_dst": "/opt/aris-deploy/vm-app/docker-compose.yml",
        "containers": ["superset", "metabase", "web"],
        "prefix": "aris",
    },
    {
        "name": "STAGING (VM-APP-STG)",
        "host": "10.202.101.146",
        "git_dir": "/opt/aris",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "compose_src": "/opt/aris/deploy/vm-app-stg/docker-compose.yml",
        "compose_dst": "/opt/aris-deploy/vm-app-stg/docker-compose.yml",
        "containers": ["superset", "metabase", "web"],
        "prefix": "aris-stg",
    },
]


def sudo(cmd):
    """Wrap a command with echo password | sudo -S."""
    return f"echo '{SSH_PASSWORD}' | sudo -S {cmd}"

def ssh_exec(client, cmd, description="", timeout=300):
    print(f"  [CMD] {description or cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if out:
        if len(out) > 3000:
            out = out[:1500] + chr(10) + "... truncated ..." + chr(10) + out[-1000:]
        print(f"  [OUT] {out}")
    if err:
        if len(err) > 2000:
            err = err[:1000] + chr(10) + "... truncated ..." + chr(10) + err[-500:]
        # Filter out the sudo password prompt from stderr
        filtered = [l for l in err.splitlines() if "[sudo]" not in l and "password for" not in l.lower()]
        if filtered:
            print(f"  [ERR] {chr(10).join(filtered)}")
    print(f"  [EXIT] {exit_code}")
    return out, err, exit_code


def connect_ssh(host):
    print(f"  Connecting to {host} as {SSH_USER}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=host, username=SSH_USER, password=SSH_PASSWORD,
                   timeout=30, look_for_keys=False, allow_agent=False)
    print(f"  Connected to {host}")
    return client

def deploy_server(server):
    name = server["name"]
    host = server["host"]
    git_dir = server["git_dir"]
    deploy_dir = server["deploy_dir"]
    compose_src = server["compose_src"]
    compose_dst = server["compose_dst"]
    containers = server["containers"]
    prefix = server["prefix"]

    sep = "=" * 70
    print(sep)
    print(f"  DEPLOYING TO: {name}")
    print(f"  Host: {host}")
    print(sep)

    client = connect_ssh(host)

    try:
        print("--- Step 0: Fix git repo ownership ---")
        ssh_exec(client, sudo(f"chown -R arisadmin:arisadmin {git_dir}"), "Fix /opt/aris ownership")

        print("--- Step 1: Git pull latest code ---")
        out, err, rc = ssh_exec(client,
            f"cd {git_dir} && git fetch origin main && git reset --hard origin/main",
            "Git fetch + reset to origin/main", timeout=120)
        if rc != 0:
            print(f"  WARNING: git pull failed (exit {rc}), retrying with ownership fix...")
            ssh_exec(client, sudo(f"chown -R arisadmin:arisadmin {git_dir}"), "Fix ownership")
            ssh_exec(client,
                f"cd {git_dir} && git fetch origin main && git reset --hard origin/main",
                "Retry git reset", timeout=120)
        ssh_exec(client, f"cd {git_dir} && git log --oneline -3", "Latest 3 commits")

        print("--- Step 2: Copy docker-compose.yml ---")
        ssh_exec(client, sudo(f"cp {compose_src} {compose_dst}"),
                 f"Copy docker-compose.yml to {deploy_dir}")

        traefik_src = f"{git_dir}/deploy/vm-app/traefik"
        traefik_dst = f"{deploy_dir}/traefik"
        if "stg" in deploy_dir:
            traefik_src = f"{git_dir}/deploy/vm-app-stg/traefik"
        ssh_exec(client,
            sudo(f"cp -r {traefik_src}/* {traefik_dst}/ 2>/dev/null") + " ; echo Traefik config copied",
            "Copy traefik config")

        print("--- Step 3: Rebuild and restart containers ---")
        services_str = " ".join(containers)
        ssh_exec(client,
            f"cd {deploy_dir} && " + sudo(f"docker compose up -d --build --no-deps {services_str}"),
            f"Rebuild + restart: {services_str}", timeout=600)

        print("  Waiting 20 seconds for containers to start...")
        time.sleep(20)
        print("--- Step 4: Check container status ---")
        for c in containers:
            cn = f"{prefix}-{c}"
            ssh_exec(client, sudo(f"docker ps --filter name={cn} --format 'table {{{{.Names}}}} {{{{.Status}}}}'"), f"Status of {cn}")

        print("--- Step 5: Verify endpoints ---")
        checks = [
            ("curl -sk -o /dev/null -w '%{http_code}' --max-time 10 'https://localhost/bi-superset/superset/welcome/?standalone=true'", "Verify /bi-superset/"),
            ("curl -sk -o /dev/null -w '%{http_code}' --max-time 10 'https://localhost/bi-metabase/'", "Verify /bi-metabase/"),
            ("curl -sk -o /dev/null -w '%{http_code}' --max-time 10 'https://localhost/static/appbuilder/css/adminlte.min.css'", "Verify /static/appbuilder/"),
            ("curl -sk -o /dev/null -w '%{http_code}' --max-time 10 'https://localhost/'", "Verify web app /"),
            ("curl -sk -o /dev/null -w '%{http_code}' --max-time 10 'https://localhost/api/bi-proxy/superset/health'", "Verify bi-proxy superset"),
            ("curl -sk -o /dev/null -w '%{http_code}' --max-time 10 'https://localhost/api/bi-proxy/grafana/api/health'", "Verify bi-proxy grafana"),
        ]
        for cmd, desc in checks:
            ssh_exec(client, cmd, desc)

        print("--- Container logs (last 10 lines each) ---")
        for c in containers:
            cn = f"{prefix}-{c}"
            ssh_exec(client, sudo(f"docker logs --tail 10 {cn} 2>&1"), f"Logs: {cn}")

        print(f"  DEPLOYMENT TO {name} COMPLETE")
    except Exception as e:
        print(f"  ERROR deploying to {name}: {e}")
        raise
    finally:
        client.close()
        print(f"  SSH connection to {host} closed.")

def main():
    sep = "=" * 70
    print(sep)
    print("  ARIS 4.0 -- BI Tools Routing Fixes Deployment")
    print("  Date: 2026-03-23")
    print("  Targets: Production + Staging")
    print(sep)
    results = {}
    for server in SERVERS:
        try:
            deploy_server(server)
            results[server["name"]] = "SUCCESS"
        except Exception as e:
            results[server["name"]] = f"FAILED: {e}"
            print("  Continuing to next server...")
    print(sep)
    print("  DEPLOYMENT SUMMARY")
    print(sep)
    for name, status in results.items():
        icon = "[OK]" if status == "SUCCESS" else "[FAIL]"
        print(f"  {icon} {name}: {status}")
    print(sep)
    if any("FAILED" in v for v in results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
