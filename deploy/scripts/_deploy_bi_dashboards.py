#!/usr/bin/env python3
"""Deploy Grafana/Superset dashboard page fixes.

Grafana: Shows provisioned dashboards (aris-overview default) instead of blank home.
Superset: Shows dashboard list instead of blank welcome page.

Requires --no-cache rebuild since NEXT_PUBLIC_* vars must be baked at build time.
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
        "prefix": "aris-stg",
    },
    "prod": {
        "ip": "10.202.101.183",
        "compose_dir": "/opt/aris-deploy/vm-app",
        "prefix": "aris",
    },
}


def sudo_cmd(cmd):
    return f"echo '{SSH_PASS}' | sudo -S {cmd}"


def ssh_exec(client, cmd, timeout=600):
    print(f"  $ {cmd[:150]}{'...' if len(cmd) > 150 else ''}")
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
        print(f"  Deploy dashboard fixes to {env.upper()} ({cfg['ip']})")
        print(f"{'='*60}")

        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        try:
            client.connect(cfg["ip"], username=SSH_USER, password=SSH_PASS, timeout=15)
            print("  Connected!")

            # Git pull
            print("\n[1/4] Git pull...")
            ssh_exec(client, sudo_cmd("git -C /opt/aris pull origin main"))

            # Copy compose
            print("\n[2/4] Copy docker-compose.yml...")
            compose_src = f"deploy/vm-app{'-stg' if env == 'stg' else ''}/docker-compose.yml"
            ssh_exec(client, sudo_cmd(
                f"cp /opt/aris/{compose_src} {cfg['compose_dir']}/docker-compose.yml"
            ))

            # Build --no-cache + start
            print("\n[3/4] Building web (--no-cache)...")
            ssh_exec(client, sudo_cmd(
                f"docker compose -f {cfg['compose_dir']}/docker-compose.yml build --no-cache web"
            ), timeout=900)
            ssh_exec(client, sudo_cmd(
                f"docker compose -f {cfg['compose_dir']}/docker-compose.yml up -d --no-deps web"
            ), timeout=120)

            time.sleep(5)

            # Verify
            print("\n[4/4] Verify...")
            o, _, _ = ssh_exec(client, sudo_cmd(
                f"docker ps --filter name={cfg['prefix']}-web --format '{{{{.Names}}}} {{{{.Status}}}}'"
            ))
            status = "RUNNING" if "Up" in (o or "") else "CHECK!"
            print(f"  {cfg['prefix']}-web: {status}")

            # Check that grafana page has provisioned dashboards
            ssh_exec(client, sudo_cmd(
                f'docker exec {cfg["prefix"]}-web sh -c '
                f'"grep -c \\\"aris-overview\\\" /app/apps/web/.next/static/chunks/*.js 2>/dev/null || echo 0"'
            ))

            print(f"\n  {env.upper()} done!")

        except Exception as e:
            print(f"\n  ERROR: {e}")
        finally:
            client.close()

    print("\n" + "=" * 60)
    print("  ALL DONE!")
    print("=" * 60)


if __name__ == "__main__":
    main()
