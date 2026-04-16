#!/usr/bin/env python3
"""Deploy knowledge-hub tags feature to STAGING + PROD (web + knowledge-hub)."""
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

SERVICES = ["knowledge-hub", "web"]


def sudo_cmd(cmd):
    return f"echo '{SSH_PASS}' | sudo -S {cmd}"


def ssh_exec(client, cmd, timeout=300):
    print(f"  $ {cmd[:120]}{'...' if len(cmd) > 120 else ''}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    rc = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if out:
        for line in out.split("\n")[-10:]:
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
        print(f"  Deploying to {env.upper()} ({cfg['ip']})")
        print(f"  Services: {', '.join(SERVICES)}")
        print(f"{'='*60}")

        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        try:
            client.connect(cfg["ip"], username=SSH_USER, password=SSH_PASS, timeout=15)
            print("  Connected!")

            # Git pull
            print("\n[1/3] Git pull...")
            ssh_exec(client, sudo_cmd("git -C /opt/aris fetch origin && git -C /opt/aris reset --hard origin/main"))

            # Rebuild services
            print("\n[2/3] Rebuilding services...")
            for svc in SERVICES:
                print(f"\n  --- {svc} ---")
                cmd = sudo_cmd(
                    f"docker compose -f {cfg['compose_dir']}/docker-compose.yml up -d --build --no-deps {svc}"
                )
                ssh_exec(client, cmd, timeout=600)

            # Verify
            print("\n[3/3] Verifying...")
            time.sleep(5)
            for svc in SERVICES:
                o, _, _ = ssh_exec(client, sudo_cmd(
                    f"docker ps --filter name={cfg['prefix']}-{svc} --format '{{{{.Names}}}} {{{{.Status}}}}'"
                ))
                status = "RUNNING" if "Up" in (o or "") else "CHECK LOGS!"
                print(f"  {cfg['prefix']}-{svc}: {status}")

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
