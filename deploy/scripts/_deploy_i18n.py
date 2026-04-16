#!/usr/bin/env python3
"""Deploy i18n language switcher changes to PROD and STG.
Rebuilds: tenant service + web frontend on both environments."""

import paramiko
import time
import sys

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = {
    "PROD": {
        "app_host": "10.202.101.183",
        "git_dir": "/opt/aris",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "compose": "docker-compose.yml",
        "prefix": "aris",
    },
    "STG": {
        "app_host": "10.202.101.146",
        "git_dir": "/opt/aris",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "compose": "docker-compose.yml",
        "prefix": "aris-stg",
    },
}


def ssh_connect(host):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)
    return c


def sudo(ssh, cmd, timeout=600):
    ch = ssh.get_transport().open_session()
    ch.settimeout(timeout)
    ch.exec_command("sudo -S " + cmd)
    ch.sendall((SSH_PASS + "\n").encode())
    time.sleep(0.5)
    out = b""
    while ch.recv_ready() or not ch.exit_status_ready():
        if ch.recv_ready():
            out += ch.recv(65536)
        else:
            time.sleep(0.3)
            if ch.exit_status_ready() and not ch.recv_ready():
                break
    lines = [l for l in out.decode("utf-8", "replace").splitlines()
             if "[sudo]" not in l]
    return "\n".join(lines)


def deploy_env(env_name, cfg):
    print(f"\n{'='*60}")
    print(f"  Deploying {env_name} — {cfg['app_host']}")
    print(f"{'='*60}")

    ssh = ssh_connect(cfg["app_host"])

    # 1. Git pull
    print("  [1/5] Git pull...")
    out = sudo(ssh, f"bash -c 'cd {cfg['git_dir']} && git pull origin main 2>&1'")
    for line in out.strip().split("\n")[-5:]:
        print(f"        {line}")

    # 2. Copy docker-compose
    compose_src = "vm-app-stg" if env_name == "STG" else "vm-app"
    print("  [2/5] Copy docker-compose.yml...")
    sudo(ssh, f"cp {cfg['git_dir']}/deploy/{compose_src}/docker-compose.yml {cfg['deploy_dir']}/docker-compose.yml")

    # 3. Rebuild tenant service
    print("  [3/5] Rebuilding tenant service...")
    out = sudo(ssh,
        f"bash -c 'cd {cfg['deploy_dir']} && docker compose up -d --build --no-deps tenant 2>&1'",
        timeout=300)
    for line in out.strip().split("\n")[-5:]:
        print(f"        {line}")

    # 4. Rebuild web frontend
    print("  [4/5] Rebuilding web frontend...")
    out = sudo(ssh,
        f"bash -c 'cd {cfg['deploy_dir']} && docker compose up -d --build --no-deps web 2>&1'",
        timeout=300)
    for line in out.strip().split("\n")[-5:]:
        print(f"        {line}")

    # 5. Verify
    print("  [5/5] Verifying services...")
    time.sleep(5)

    for svc in ["tenant", "web"]:
        status = sudo(ssh, f"docker ps --filter name={cfg['prefix']}-{svc} --format '{{{{.Status}}}}'", timeout=10)
        print(f"        {cfg['prefix']}-{svc}: {status.strip()}")

    # Test public i18n endpoint
    out = sudo(ssh, f"curl -s http://localhost:3001/api/v1/public/i18n", timeout=10)
    print(f"        Public i18n endpoint: {out.strip()[:120]}")

    ssh.close()
    print(f"  {env_name} deployment complete!")


def main():
    print("=" * 60)
    print("  Deploy i18n language switcher — PROD + STG")
    print("=" * 60)

    for env_name, cfg in ENVS.items():
        try:
            deploy_env(env_name, cfg)
        except Exception as e:
            print(f"\n  ERROR on {env_name}: {e}")
            import traceback
            traceback.print_exc()

    print(f"\n{'='*60}")
    print("  ALL DONE!")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
