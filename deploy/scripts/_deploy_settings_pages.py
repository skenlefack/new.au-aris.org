#!/usr/bin/env python3
"""Rebuild web container on STG and PROD for settings page locale fixes."""

import paramiko
import time

ENVS = [
    {
        'name': 'STG',
        'host': '10.202.101.146',
        'deploy_dir': '/opt/aris-deploy/vm-app-stg',
        'code_dir': '/opt/aris',
        'prefix': 'aris-stg',
    },
    {
        'name': 'PROD',
        'host': '10.202.101.183',
        'deploy_dir': '/opt/aris-deploy/vm-app',
        'code_dir': '/opt/aris',
        'prefix': 'aris',
    },
]

SSH_USER = 'arisadmin'
SSH_PASS = '@u-1baR.0rg$U24'

def run(client, cmd, desc='', timeout=300):
    print(f"\n{'─'*60}")
    if desc:
        print(f"  [{desc}]")
    print(f"  $ {cmd}")
    print('─'*60)
    chan = client.get_transport().open_session()
    chan.get_pty()
    chan.exec_command(cmd)
    out = b''
    start = time.time()
    while True:
        if chan.recv_ready():
            chunk = chan.recv(4096)
            out += chunk
            print(chunk.decode('utf-8', errors='replace'), end='', flush=True)
        if chan.exit_status_ready():
            while chan.recv_ready():
                chunk = chan.recv(4096)
                out += chunk
                print(chunk.decode('utf-8', errors='replace'), end='', flush=True)
            break
        if time.time() - start > timeout:
            print(f"\n[TIMEOUT after {timeout}s]")
            break
        time.sleep(0.1)
    exit_code = chan.recv_exit_status()
    print(f"\n  [exit: {exit_code}]")
    return exit_code, out.decode('utf-8', errors='replace')

def deploy_env(env):
    print(f"\n{'='*70}")
    print(f"  DEPLOYING WEB TO {env['name']} — {env['host']}")
    print(f"{'='*70}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(env['host'], username=SSH_USER, password=SSH_PASS, timeout=30)

    # 1. Git pull (already done by message deploy, but ensure latest)
    run(client, f"cd {env['code_dir']} && git pull origin main 2>&1 | tail -5",
        'git pull', timeout=60)

    # 2. Build web (uses env vars from .env in deploy dir)
    run(client,
        f"cd {env['deploy_dir']} && sudo docker compose build --no-cache web 2>&1 | tail -30",
        'build web (no-cache)', timeout=600)

    # 3. Restart web
    run(client,
        f"cd {env['deploy_dir']} && sudo docker compose up -d --no-deps web",
        'restart web', timeout=60)

    # 4. Check web is up
    time.sleep(8)
    run(client,
        f'curl -sk https://localhost/health 2>&1 | head -3 || echo "direct health not available"',
        'web health check')

    client.close()
    print(f"\n  [{env['name']}] Done.")

def main():
    for env in ENVS:
        deploy_env(env)
    print("\nWeb deployed to all environments.")

if __name__ == '__main__':
    main()
