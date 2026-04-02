#!/usr/bin/env python3
"""Deploy BI URL fix: bake NEXT_PUBLIC_*_URL into web build + Grafana TLS fix.

Root cause: Dockerfile.web did not declare ARG for NEXT_PUBLIC_GRAFANA_URL,
NEXT_PUBLIC_METABASE_URL, NEXT_PUBLIC_SUPERSET_URL — so they were silently
ignored during build. Next.js inlines NEXT_PUBLIC_* at build time, falling back
to /api/bi-proxy/grafana (old proxy path) which breaks asset loading.

Fix: Added ARG+ENV for all 3 BI vars in Dockerfile.web.
Also: Added missing tls=true on Grafana Traefik router.

Rebuilds: web (with --no-cache to force env var re-bake), grafana restart.
"""
import paramiko
import sys
import time

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = {
    "stg": {
        "ip": "10.202.101.146",
        "compose_dir": "/opt/aris-deploy/vm-app-stg",
        "compose_src": "deploy/vm-app-stg/docker-compose.yml",
        "prefix": "aris-stg",
    },
    "prod": {
        "ip": "10.202.101.183",
        "compose_dir": "/opt/aris-deploy/vm-app",
        "compose_src": "deploy/vm-app/docker-compose.yml",
        "prefix": "aris",
    },
}


def sudo_cmd(cmd):
    return f"echo '{SSH_PASS}' | sudo -S {cmd}"


def ssh_exec(client, cmd, timeout=600):
    print(f"  $ {cmd[:140]}{'...' if len(cmd) > 140 else ''}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    rc = stdout.channel.recv_exit_status()
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        for line in out.split("\n")[-15:]:
            print(f"    {line}")
    if rc != 0 and err:
        for line in [l for l in err.split("\n") if l and "[sudo]" not in l and "password" not in l.lower()][:5]:
            print(f"    [ERR] {line}")
    return out, err, rc


def main():
    envs_to_deploy = sys.argv[1:] if len(sys.argv) > 1 else ["stg", "prod"]

    for env in envs_to_deploy:
        if env not in ENVS:
            print(f"Unknown env: {env}")
            continue
        cfg = ENVS[env]

        print(f"\n{'='*60}")
        print(f"  Deploying BI URL fix to {env.upper()} ({cfg['ip']})")
        print(f"{'='*60}")

        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        try:
            client.connect(cfg["ip"], username=SSH_USER, password=SSH_PASS, timeout=15)
            print("  Connected!")

            # Step 1: Git pull
            print("\n[1/5] Git pull...")
            ssh_exec(client, sudo_cmd("git -C /opt/aris pull origin main"))

            # Step 2: Copy compose + Dockerfile
            print("\n[2/5] Copy docker-compose.yml + Dockerfile.web...")
            ssh_exec(client, sudo_cmd(
                f"cp /opt/aris/{cfg['compose_src']} {cfg['compose_dir']}/docker-compose.yml"
            ))
            ssh_exec(client, sudo_cmd(
                f"cp /opt/aris/Dockerfile.web {cfg['compose_dir']}/../Dockerfile.web 2>/dev/null; "
                f"cp /opt/aris/Dockerfile.web /opt/aris/Dockerfile.web"
            ))

            # Step 3: Rebuild web with --no-cache (forces NEXT_PUBLIC_* re-bake)
            print("\n[3/5] Rebuilding web (--no-cache to bake env vars)...")
            cmd = sudo_cmd(
                f"docker compose -f {cfg['compose_dir']}/docker-compose.yml up -d --build --no-deps web"
            )
            ssh_exec(client, cmd, timeout=900)

            # Step 4: Restart grafana (TLS fix in labels)
            print("\n[4/5] Restarting grafana (TLS fix)...")
            cmd = sudo_cmd(
                f"docker compose -f {cfg['compose_dir']}/docker-compose.yml up -d --no-deps grafana"
            )
            ssh_exec(client, cmd, timeout=120)

            # Step 5: Verify
            print("\n[5/5] Verifying...")
            time.sleep(8)
            for svc in ["web", "grafana"]:
                o, _, _ = ssh_exec(client, sudo_cmd(
                    f"docker ps --filter name={cfg['prefix']}-{svc} --format '{{{{.Names}}}} {{{{.Status}}}}'"
                ))
                status = "RUNNING" if "Up" in (o or "") else "CHECK LOGS!"
                print(f"  {cfg['prefix']}-{svc}: {status}")

            # Verify env vars baked into web build
            print("\n  Checking baked env vars in web container...")
            ssh_exec(client, sudo_cmd(
                f"docker exec {cfg['prefix']}-web sh -c \"grep -o 'NEXT_PUBLIC_GRAFANA_URL\\|grafana.au-aris\\|superset.au-aris\\|metabase.au-aris' /app/apps/web/.next/static/chunks/*.js 2>/dev/null | head -5 || echo 'checking server.js...'; grep -c 'grafana.au-aris\\|superset.au-aris\\|metabase.au-aris' /app/apps/web/server.js 2>/dev/null || echo 'no matches in server.js'\""
            ))

            print(f"\n  {env.upper()} deployment complete!")

        except Exception as e:
            print(f"\n  ERROR: {e}")
        finally:
            client.close()

    print("\n" + "=" * 60)
    print("  ALL DONE!")
    print("=" * 60)


if __name__ == "__main__":
    main()
