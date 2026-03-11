#!/usr/bin/env python3
import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

PASSWORD = '@u-1baR.0rg$U24'
USER = 'arisadmin'

vms = {
    'VM-APP': '10.202.101.183',
    'VM-KAFKA': '10.202.101.184',
    'VM-DB': '10.202.101.185',
    'VM-CACHE': '10.202.101.186',
}

for name, ip in vms.items():
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(ip, username=USER, password=PASSWORD, timeout=10, allow_agent=False, look_for_keys=False)
        stdin, stdout, stderr = client.exec_command('hostname')
        hostname = stdout.read().decode().strip()
        print(f'{name} ({ip}): SUCCESS -> {hostname}')
        client.close()
    except paramiko.AuthenticationException:
        print(f'{name} ({ip}): Auth FAILED')
    except Exception as e:
        print(f'{name} ({ip}): ERROR -> {e}')
