#!/usr/bin/env python3
"""Docker system prune on VM-APP PROD and VM-APP STG to free disk space."""

import paramiko
import time

TARGETS = [
    ('VM-APP PROD', '10.202.101.183'),
    ('VM-APP STG',  '10.202.101.146'),
]
SSH_USER = 'arisadmin'
SSH_PASS = '@u-1baR.0rg$U24'

def run(client, cmd, timeout=120):
    # Use stdin/stdout directly (no PTY) so sudo -S can read password from stdin
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    try:
        stdin.write(SSH_PASS + '\n')
        stdin.flush()
    except Exception:
        pass
    out = stdout.read().decode('utf-8', 'replace')
    err = stderr.read().decode('utf-8', 'replace')
    return (out + err).strip()

def main():
    for name, host in TARGETS:
        print(f'\n{"="*60}')
        print(f'  {name}  ({host})')
        print(f'{"="*60}')
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            c.connect(host, username=SSH_USER, password=SSH_PASS, timeout=10)

            # Disk before
            df_before = run(c, "df -h --output=size,used,avail,pcent / 2>/dev/null | tail -1")
            print(f'  Avant : {df_before}')

            # Prune (stopped containers, dangling images, build cache — NO volumes)
            print('  Pruning...')
            prune_cmd = "echo '" + SSH_PASS + "' | sudo -S docker system prune -f 2>&1"
            out = run(c, prune_cmd, timeout=180)
            for line in out.splitlines():
                if line.strip():
                    print(f'  {line.strip()}')

            # Disk after
            df_after = run(c, "df -h --output=size,used,avail,pcent / 2>/dev/null | tail -1")
            print(f'  Après : {df_after}')

            c.close()
        except Exception as e:
            print(f'  ERREUR: {e}')

    print('\nTerminé.')

if __name__ == '__main__':
    main()
