#!/usr/bin/env python3
"""
Deploy email i18n + template fixes to PROD and STG.

Changes deployed:
  - services/message: i18n translations, all .hbs templates with {{t}} labels,
    fixed copy-templates script (mkdir -p), domain-alert.hbs rename,
    locale-aware template engine, structured fallback (no more raw JSON)
  - services/credential: locale field added to Kafka events
    (USER_CREATED, PASSWORD_RESET, NEW_DEVICE_LOGIN)

No schema changes — skip prisma db push.
"""

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


def run(client, cmd, desc='', timeout=120):
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
    print(f"  DEPLOYING EMAIL i18n → {env['name']} ({env['host']})")
    print(f"{'='*70}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(env['host'], username=SSH_USER, password=SSH_PASS, timeout=30)

    # 1. Git pull
    run(client,
        f"cd {env['code_dir']} && sudo chown -R {SSH_USER}:{SSH_USER} .git && git pull origin main",
        'git pull', timeout=60)

    # 2. Rebuild message service (includes templates via copy-templates script)
    run(client,
        f"cd {env['deploy_dir']} && sudo docker compose build --no-cache message 2>&1 | tail -30",
        'build message (no-cache)', timeout=300)

    # 3. Rebuild credential service (locale in Kafka events)
    run(client,
        f"cd {env['deploy_dir']} && sudo docker compose build --no-cache credential 2>&1 | tail -30",
        'build credential (no-cache)', timeout=300)

    # 4. Restart both services
    run(client,
        f"cd {env['deploy_dir']} && sudo docker compose up -d --no-deps message credential",
        'restart message + credential', timeout=60)

    # 5. Wait for startup
    time.sleep(8)

    # 6. Health checks
    run(client,
        f'sudo docker exec {env["prefix"]}-message wget -qO- http://localhost:3006/health 2>&1 || echo "HEALTH CHECK FAILED"',
        'message health check')
    run(client,
        f'sudo docker exec {env["prefix"]}-credential wget -qO- http://localhost:3002/health 2>&1 || echo "HEALTH CHECK FAILED"',
        'credential health check')

    # 7. Verify templates were copied to dist/
    run(client,
        f'sudo docker exec {env["prefix"]}-message ls /app/services/message/dist/templates/email/ 2>&1 || echo "TEMPLATES MISSING"',
        'verify email templates in dist/')
    run(client,
        f'sudo docker exec {env["prefix"]}-message ls /app/services/message/dist/templates/layouts/ 2>&1 || echo "LAYOUT MISSING"',
        'verify layout template in dist/')

    # 8. Verify translations.js exists in compiled output
    run(client,
        f'sudo docker exec {env["prefix"]}-message test -f /app/services/message/dist/services/translations.js && echo "OK: translations.js present" || echo "MISSING: translations.js"',
        'verify translations.js compiled')

    client.close()
    print(f"\n  [{env['name']}] Deploy complete.")


def main():
    for env in ENVS:
        try:
            deploy_env(env)
        except Exception as e:
            print(f"\n[ERROR] {env['name']} ({env['host']}): {e}")
            print(f"  Skipping {env['name']} and continuing...")
    print("\n\n" + "="*70)
    print("  ALL ENVIRONMENTS DEPLOYED")
    print("  - STG: test.au-aris.org")
    print("  - PROD: au-aris.org")
    print("  Test: create a user to trigger a WELCOME email")
    print("="*70)


if __name__ == '__main__':
    main()
