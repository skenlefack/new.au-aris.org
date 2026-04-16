#!/usr/bin/env python3
"""Rebuild web with --no-cache to bake NEXT_PUBLIC_* env vars into Next.js build."""
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
        "grafana_url": "grafana-test.au-aris.org",
        "superset_url": "superset-test.au-aris.org",
        "metabase_url": "metabase-test.au-aris.org",
    },
    "prod": {
        "ip": "10.202.101.183",
        "compose_dir": "/opt/aris-deploy/vm-app",
        "prefix": "aris",
        "grafana_url": "grafana.au-aris.org",
        "superset_url": "superset.au-aris.org",
        "metabase_url": "metabase.au-aris.org",
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
        for line in [l for l in err.split("\n") if l and "[sudo]" not in l and "password" not in l.lower()][:8]:
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
        print(f"  Rebuild web (--no-cache) on {env.upper()} ({cfg['ip']})")
        print(f"{'='*60}")

        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        try:
            client.connect(cfg["ip"], username=SSH_USER, password=SSH_PASS, timeout=15)
            print("  Connected!")

            # Step 1: Build with --no-cache
            print("\n[1/3] Building web with --no-cache (this takes ~3-5 min)...")
            ssh_exec(client, sudo_cmd(
                f"docker compose -f {cfg['compose_dir']}/docker-compose.yml build --no-cache web"
            ), timeout=900)

            # Step 2: Start new container
            print("\n[2/3] Starting web container...")
            ssh_exec(client, sudo_cmd(
                f"docker compose -f {cfg['compose_dir']}/docker-compose.yml up -d --no-deps web"
            ), timeout=120)

            time.sleep(5)

            # Step 3: Verify env vars are baked
            print("\n[3/3] Checking baked env vars in static JS chunks...")
            for domain in [cfg["grafana_url"], cfg["superset_url"], cfg["metabase_url"]]:
                o, _, _ = ssh_exec(client, sudo_cmd(
                    f'docker exec {cfg["prefix"]}-web sh -c '
                    f'"grep -rl \\"{domain}\\" /app/apps/web/.next/static/ 2>/dev/null | wc -l"'
                ))
                count = o.strip() if o else "0"
                status = "BAKED" if count != "0" else "MISSING!"
                print(f"  {domain}: {status} ({count} files)")

            # Verify container running
            o, _, _ = ssh_exec(client, sudo_cmd(
                f"docker ps --filter name={cfg['prefix']}-web --format '{{{{.Names}}}} {{{{.Status}}}}'"
            ))
            print(f"  Container: {o}")

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
