#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deploy i18n + profile language preference changes to staging and production."""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import paramiko

ENVS = [
    {
        'name': 'STAGING',
        'host': '10.202.101.146',
        'compose_dir': '/opt/aris-deploy/vm-app-stg',
        'tenant_svc': 'aris-stg-tenant',
        'web_svc': 'aris-stg-web',
    },
    {
        'name': 'PRODUCTION',
        'host': '10.202.101.183',
        'compose_dir': '/opt/aris-deploy/vm-app',
        'tenant_svc': 'aris-tenant',
        'web_svc': 'aris-web',
    },
]

USER = 'arisadmin'
PASSWORD = '@u-1baR.0rg$U24'


def run(ssh, cmd, desc=''):
    if desc:
        print(f'  $ {desc}')
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    combined = (out + err).strip()
    if combined:
        for line in combined.splitlines():
            print(f'    {line}'.encode('utf-8', errors='replace').decode('utf-8', errors='replace'))
    return combined


def deploy_env(env):
    name = env['name']
    host = env['host']
    compose = env['compose_dir']
    compose_file = f'{compose}/docker-compose.yml'

    print(f'\nConnected to {name}')
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=USER, password=PASSWORD, timeout=30)

    print('\n[1/4] git pull...')
    run(ssh,
        f"echo '{PASSWORD}' | sudo -S git -C /opt/aris pull origin main",
        'git pull /opt/aris')

    print('\n[2/4] copy compose...')
    run(ssh,
        f"echo '{PASSWORD}' | sudo -S cp /opt/aris/deploy/vm-app/docker-compose.yml {compose_file}",
        f'cp compose -> {compose_file}')

    print(f'\n[3a] rebuild tenant ({env["tenant_svc"]})...')
    run(ssh,
        f"echo '{PASSWORD}' | sudo -S docker compose -f {compose_file} up -d --build --no-deps tenant",
        f'docker compose up tenant')

    print(f'\n[3b] rebuild web ({env["web_svc"]})...')
    run(ssh,
        f"echo '{PASSWORD}' | sudo -S docker compose -f {compose_file} up -d --build --no-deps web",
        f'docker compose up web')

    print('\n[4/4] verify...')
    run(ssh,
        f"echo '{PASSWORD}' | sudo -S docker ps --filter name={env['tenant_svc']} --format '{{{{.Names}}}} {{{{.Status}}}}'",
        f'docker ps {env["tenant_svc"]}')
    run(ssh,
        f"echo '{PASSWORD}' | sudo -S docker ps --filter name={env['web_svc']} --format '{{{{.Names}}}} {{{{.Status}}}}'",
        f'docker ps {env["web_svc"]}')

    ssh.close()
    print(f'{name} DONE\n')


if __name__ == '__main__':
    targets = sys.argv[1:] if len(sys.argv) > 1 else ['staging', 'production']
    for env in ENVS:
        if env['name'].lower() in [t.lower() for t in targets]:
            deploy_env(env)
