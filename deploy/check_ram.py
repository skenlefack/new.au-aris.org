#!/usr/bin/env python3
"""Check Hyper-V dynamic memory details on all VMs."""
import paramiko, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

PASSWORD = '@u-1baR.0rg$U24'
USER = 'arisadmin'

vms = {
    'VM-APP':   '10.202.101.183',
    'VM-KAFKA': '10.202.101.184',
    'VM-DB':    '10.202.101.185',
    'VM-CACHE': '10.202.101.186',
}

commands = {
    'meminfo_total':     'grep MemTotal /proc/meminfo',
    'meminfo_available': 'grep MemAvailable /proc/meminfo',
    'free_h':            'free -h',
    'hv_balloon':        'lsmod | grep hv_balloon || echo NO_BALLOON_MODULE',
    'hv_modules':        'lsmod | grep hv_',
    'dmesg_memory':      'sudo dmesg 2>/dev/null | grep -iE "memory|balloon|hyper.*mem|hot.?plug" | tail -20 || echo N/A',
    'dmidecode_mem':     'sudo dmidecode -t memory 2>/dev/null | grep -E "Maximum Capacity|Size|Locator|Type:" | head -20 || echo N/A',
    'auto_online':       'cat /sys/devices/system/memory/auto_online_blocks 2>/dev/null || echo N/A',
    'block_size':        'cat /sys/devices/system/memory/block_size_bytes 2>/dev/null || echo N/A',
    'memory_blocks':     'ls /sys/devices/system/memory/ 2>/dev/null | grep -c memory || echo N/A',
    'online_blocks':     'grep -l online /sys/devices/system/memory/memory*/state 2>/dev/null | wc -l || echo N/A',
    'offline_blocks':    'grep -l offline /sys/devices/system/memory/memory*/state 2>/dev/null | wc -l || echo N/A',
    'hv_utils_ver':      'modinfo hv_utils 2>/dev/null | grep -E "version|description" || echo N/A',
    'hv_balloon_info':   'modinfo hv_balloon 2>/dev/null | grep -E "version|description" || echo N/A',
}

for name, ip in vms.items():
    print(f'\n{"=" * 60}')
    print(f'{name} ({ip})')
    print(f'{"=" * 60}')
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(ip, username=USER, password=PASSWORD, timeout=10, allow_agent=False, look_for_keys=False)
        for cmd_name, cmd in commands.items():
            stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
            out = stdout.read().decode('utf-8', errors='replace').strip()
            err = stderr.read().decode('utf-8', errors='replace').strip()
            result = out if out else err if err else '(empty)'
            print(f'\n--- {cmd_name} ---')
            print(result)
        client.close()
    except Exception as e:
        print(f'ERROR: {e}')
