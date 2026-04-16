#!/usr/bin/env python3
"""
Deploy message + credential services to STG and PROD.
Includes prisma db push for new schema changes (UserDevice, WHATSAPP/TELEGRAM).
"""

import paramiko
import time

ENVS = [
    {
        'name': 'PROD',
        'host': '10.202.101.183',
        'deploy_dir': '/opt/aris-deploy/vm-app',
        'code_dir': '/opt/aris',
        'prefix': 'aris',
        'db_url': 'postgresql://aris_user:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:6432/aris_db?pgbouncer=true',
        'db_direct': 'postgresql://aris_user:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris_db',
    },
    {
        'name': 'STG',
        'host': '10.202.101.146',
        'deploy_dir': '/opt/aris-deploy/vm-app-stg',
        'code_dir': '/opt/aris',
        'prefix': 'aris-stg',
        'db_url': 'postgresql://aris_user:Ar1s_Stg_2024!xK9mZ@10.202.101.148:6432/aris_db?pgbouncer=true',
        'db_direct': 'postgresql://aris_user:Ar1s_Stg_2024!xK9mZ@10.202.101.148:5432/aris_db',
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
    print(f"  DEPLOYING TO {env['name']} — {env['host']}")
    print(f"{'='*70}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(env['host'], username=SSH_USER, password=SSH_PASS, timeout=30)

    # 1. Git pull
    run(client, f"cd {env['code_dir']} && sudo chown -R {SSH_USER}:{SSH_USER} .git && git pull origin main",
        'git pull', timeout=60)

    # 2. Copy docker-compose to deploy dir
    run(client, f"sudo cp {env['code_dir']}/deploy/vm-app/docker-compose.yml {env['deploy_dir']}/docker-compose.yml",
        'copy docker-compose.yml')

    # 3. Prisma db push — message schema (WHATSAPP/TELEGRAM + preference columns)
    print(f"\n  [Prisma db push — message schema]")
    db_direct = env['db_direct']
    prisma_cmd = (
        f'docker exec -w /app/packages/db-schemas '
        f'-e DATABASE_URL="{db_direct}" '
        f'-e DIRECT_DATABASE_URL="{db_direct}" '
        f'{env["prefix"]}-message '
        f'npx prisma db push --schema=prisma --accept-data-loss 2>&1 || true'
    )
    run(client, f"cd {env['deploy_dir']} && sudo {prisma_cmd}", 'prisma db push message', timeout=90)

    # 4. Prisma db push — credential schema (UserDevice model)
    print(f"\n  [Prisma db push — credential schema]")
    prisma_cmd_cred = (
        f'docker exec -w /app/packages/db-schemas '
        f'-e DATABASE_URL="{db_direct}" '
        f'-e DIRECT_DATABASE_URL="{db_direct}" '
        f'{env["prefix"]}-credential '
        f'npx prisma db push --schema=prisma --accept-data-loss 2>&1 || true'
    )
    run(client, f"cd {env['deploy_dir']} && sudo {prisma_cmd_cred}", 'prisma db push credential', timeout=90)

    # 5. Rebuild message service
    run(client,
        f"cd {env['deploy_dir']} && sudo docker compose build --no-cache message 2>&1 | tail -20",
        'build message (no-cache)', timeout=300)

    # 6. Rebuild credential service
    run(client,
        f"cd {env['deploy_dir']} && sudo docker compose build --no-cache credential 2>&1 | tail -20",
        'build credential (no-cache)', timeout=300)

    # 7. Restart services
    run(client,
        f"cd {env['deploy_dir']} && sudo docker compose up -d --no-deps message credential",
        'restart message + credential', timeout=60)

    # 8. Health checks
    time.sleep(5)
    run(client,
        f'sudo docker exec {env["prefix"]}-message wget -qO- http://localhost:3006/health 2>&1 || echo "health check failed"',
        'message health check')
    run(client,
        f'sudo docker exec {env["prefix"]}-credential wget -qO- http://localhost:3002/health 2>&1 || echo "health check failed"',
        'credential health check')

    # 9. Verify test-email route is in compiled output
    run(client,
        f'sudo docker exec {env["prefix"]}-message grep -c "test-email" /app/services/message/dist/routes/notification.routes.js 2>&1 || echo "STILL MISSING"',
        'verify test-email in compiled output')

    client.close()
    print(f"\n  [{env['name']}] Done.")

def main():
    for env in ENVS:
        try:
            deploy_env(env)
        except Exception as e:
            print(f"\n[ERROR] {env['name']} ({env['host']}): {e}")
            print(f"  Skipping {env['name']} and continuing...")
    print("\n\nDone.")

if __name__ == '__main__':
    main()
