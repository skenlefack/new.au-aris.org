#!/usr/bin/env python3
"""
ARIS 4.0 — VM Audit Script
Connects to all 4 VMs and generates a full hardware/system audit report.
Run: python deploy/audit_vms.py

Prerequisites: pip install paramiko
Output: deploy/vm_audit_report.json + deploy/ARIS_VM_Audit_Report.md
"""

import paramiko
import json
import sys
import io
import threading
import os
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ── Connection parameters ──
USER = "arisadmin"
PASSWORD = "@u-1baR.0rg$U24"
SSH_KEY = os.path.expanduser("~/.ssh/id_rsa")

VMS = {
    "VM-APP": {"ip": "10.202.101.183", "hostname": "nbo-aris04", "role": "Application Server"},
    "VM-KAFKA": {"ip": "10.202.101.184", "hostname": "nbo-brk01", "role": "Kafka Message Bus"},
    "VM-DB": {"ip": "10.202.101.185", "hostname": "nbo-dbms03", "role": "PostgreSQL Database"},
    "VM-CACHE": {"ip": "10.202.101.186", "hostname": "nbo-cch01", "role": "Redis + OpenSearch"},
}

# ── Specifications from deployment docs ──
SPECS = {
    "VM-APP": {"vcpu": 16, "ram_gb": 32, "disk_gb": 300, "disk_type": "SSD"},
    "VM-KAFKA": {"vcpu": 8, "ram_gb": 16, "disk_gb": 500, "disk_type": "NVMe"},
    "VM-DB": {"vcpu": 8, "ram_gb": 32, "disk_gb": 1000, "disk_type": "SSD+HDD"},
    "VM-CACHE": {"vcpu": 8, "ram_gb": 32, "disk_gb": 200, "disk_type": "SSD"},
}

# ── Commands to audit ──
COMMANDS = {
    # System Identity
    "hostname": "hostname",
    "fqdn": "hostname -f 2>/dev/null || hostname",
    "os_release": "cat /etc/os-release",
    "kernel": "uname -r",
    "arch": "uname -m",
    "uptime": "uptime -p",
    "boot_time": "uptime -s",
    "timezone": "timedatectl | grep 'Time zone' || echo 'N/A'",

    # CPU
    "cpu_count": "nproc",
    "cpu_model": "lscpu | grep 'Model name' || echo 'N/A'",
    "cpu_sockets": "lscpu | grep 'Socket(s)' || echo 'N/A'",
    "cpu_cores_per_socket": "lscpu | grep 'Core(s) per socket' || echo 'N/A'",
    "cpu_threads": "lscpu | grep 'Thread(s) per core' || echo 'N/A'",
    "cpu_full": "lscpu",

    # RAM
    "memory": "free -h",
    "memory_bytes": "free -b | grep Mem | awk '{print $2}'",

    # Disks & Partitions
    "lsblk": "lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,MODEL",
    "df": "df -hT",
    "lvs": "sudo lvs --noheadings 2>/dev/null || echo 'No LVM'",
    "vgs": "sudo vgs --noheadings 2>/dev/null || echo 'No VGS'",
    "pvs": "sudo pvs --noheadings 2>/dev/null || echo 'No PVS'",
    "fstab": "cat /etc/fstab | grep -v '^#' | grep -v '^$'",
    "swap": "swapon --show 2>/dev/null || echo 'No swap'",

    # Network
    "ip_addr": "ip -4 addr show | grep -E 'inet |mtu'",
    "default_route": "ip route | grep default",
    "dns": "cat /etc/resolv.conf | grep -v '^#'",
    "netplan": "cat /etc/netplan/*.yaml 2>/dev/null || echo 'No netplan'",
    "ufw_status": "sudo ufw status verbose 2>/dev/null || echo 'UFW N/A'",
    "listening_ports": "ss -tlnp 2>/dev/null",

    # Kernel Parameters
    "swappiness": "cat /proc/sys/vm/swappiness",
    "max_map_count": "cat /proc/sys/vm/max_map_count",
    "overcommit_memory": "cat /proc/sys/vm/overcommit_memory",
    "overcommit_ratio": "cat /proc/sys/vm/overcommit_ratio 2>/dev/null || echo 'N/A'",
    "somaxconn": "cat /proc/sys/net/core/somaxconn",
    "dirty_ratio": "cat /proc/sys/vm/dirty_ratio",
    "dirty_bg_ratio": "cat /proc/sys/vm/dirty_background_ratio",
    "shmmax": "cat /proc/sys/kernel/shmmax",
    "thp": "cat /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || echo 'N/A'",

    # Security
    "sysctl_custom": "cat /etc/sysctl.d/*.conf 2>/dev/null; cat /etc/sysctl.conf | grep -v '^#' | grep -v '^$' 2>/dev/null",
    "limits": "cat /etc/security/limits.conf | grep -v '^#' | grep -v '^$' 2>/dev/null || echo 'N/A'",
    "ssh_config": "grep -E '^[^#]' /etc/ssh/sshd_config 2>/dev/null",
    "users_login": "getent passwd | awk -F: '$7 ~ /bash|sh/ {print $1\":\"$3\":\"$6}'",
    "sudoers": "sudo cat /etc/sudoers.d/* 2>/dev/null | head -20 || echo 'N/A'",
    "fail2ban": "sudo fail2ban-client status 2>/dev/null || echo 'fail2ban not installed'",

    # Software Installed
    "docker_version": "docker --version 2>/dev/null || echo 'Not installed'",
    "docker_info": "docker info 2>/dev/null || echo 'Not accessible'",
    "docker_ps": "docker ps -a --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}' 2>/dev/null || echo 'N/A'",
    "docker_images": "docker images --format 'table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}' 2>/dev/null || echo 'N/A'",
    "docker_volumes": "docker volume ls 2>/dev/null || echo 'N/A'",
    "docker_networks": "docker network ls 2>/dev/null || echo 'N/A'",
    "docker_compose": "docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || echo 'Not installed'",
    "snap_list": "snap list 2>/dev/null || echo 'snapd not installed'",
    "node_version": "node --version 2>/dev/null || echo 'Not installed'",
    "npm_version": "npm --version 2>/dev/null || echo 'Not installed'",
    "pnpm_version": "pnpm --version 2>/dev/null || echo 'Not installed'",
    "python_version": "python3 --version 2>/dev/null || echo 'Not installed'",
    "java_version": "java -version 2>&1 || echo 'Not installed'",
    "postgresql_version": "psql --version 2>/dev/null || echo 'Not installed'",
    "pgbouncer_version": "pgbouncer --version 2>/dev/null || echo 'Not installed'",
    "redis_version": "redis-server --version 2>/dev/null || echo 'Not installed'",
    "opensearch_check": "curl -s http://localhost:9200 2>/dev/null || echo 'Not running'",
    "nginx_version": "nginx -v 2>&1 || echo 'Not installed'",
    "traefik_version": "traefik version 2>/dev/null || echo 'Not installed'",

    # LUKS
    "luks_check": "sudo blkid | grep -i luks 2>/dev/null || echo 'No LUKS'",
    "dm_status": "ls -la /dev/mapper/ 2>/dev/null",

    # Special directories
    "kafka_data_check": "ls -la /kafka-data 2>/dev/null && df -T /kafka-data 2>/dev/null || echo 'Not present'",
    "docker_dir_check": "df -T /var/lib/docker 2>/dev/null || echo 'Not separate'",
    "pg_dir_check": "df -T /var/lib/postgresql 2>/dev/null || echo 'Not separate'",
    "redis_dir_check": "df -T /var/lib/redis 2>/dev/null || echo 'Not separate'",
    "opensearch_dir_check": "df -T /var/lib/opensearch 2>/dev/null || echo 'Not separate'",
    "log_dir_check": "df -T /var/log 2>/dev/null || echo 'Not separate'",

    # System Services
    "systemd_services": "systemctl list-units --type=service --state=running --no-pager 2>/dev/null | head -40",
    "systemd_failed": "systemctl list-units --type=service --state=failed --no-pager 2>/dev/null",

    # Packages
    "apt_packages": "dpkg --get-selections | wc -l",
    "last_apt_update": "stat -c '%y' /var/lib/apt/lists/lock 2>/dev/null || echo 'N/A'",
    "pending_updates": "apt list --upgradable 2>/dev/null | wc -l",

    # Chrony / NTP
    "ntp_status": "chronyc tracking 2>/dev/null || timedatectl show --property=NTPSynchronized 2>/dev/null || echo 'N/A'",
}

results = {}
lock = threading.Lock()


def connect_ssh(ip):
    """Try to connect via key, then via password."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    # Try key first
    if os.path.exists(SSH_KEY):
        try:
            key = paramiko.RSAKey.from_private_key_file(SSH_KEY)
            client.connect(ip, username=USER, pkey=key, timeout=15, allow_agent=False, look_for_keys=False)
            return client
        except Exception:
            pass

    # Try password
    try:
        client.connect(ip, username=USER, password=PASSWORD, timeout=15, allow_agent=False, look_for_keys=False)
        return client
    except Exception:
        pass

    # Try agent + auto keys
    try:
        client.connect(ip, username=USER, timeout=15, allow_agent=True, look_for_keys=True)
        return client
    except Exception as e:
        raise e


def audit_vm(name, vm_info):
    ip = vm_info["ip"]
    vm_results = {"ip": ip, "hostname_expected": vm_info["hostname"], "role": vm_info["role"]}

    try:
        client = connect_ssh(ip)
        vm_results["_connection"] = "SUCCESS"

        for cmd_name, cmd in COMMANDS.items():
            try:
                stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
                output = stdout.read().decode('utf-8', errors='replace').strip()
                err = stderr.read().decode('utf-8', errors='replace').strip()
                vm_results[cmd_name] = output if output else err if err else "(empty)"
            except Exception as e:
                vm_results[cmd_name] = f"ERROR: {str(e)}"

        client.close()
    except Exception as e:
        vm_results["_connection"] = f"FAILED: {str(e)}"

    with lock:
        results[name] = vm_results


def main():
    print(f"ARIS VM Audit — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    threads = []
    for name, vm_info in VMS.items():
        print(f"  Connecting to {name} ({vm_info['ip']})...")
        t = threading.Thread(target=audit_vm, args=(name, vm_info))
        threads.append(t)
        t.start()

    for t in threads:
        t.join(timeout=300)

    # Save raw JSON
    output_path = os.path.join(os.path.dirname(__file__), 'vm_audit_report.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({
            "audit_date": datetime.now().isoformat(),
            "auditor": "Claude Code (ARIS CC-5)",
            "specs": SPECS,
            "results": results
        }, f, indent=2, ensure_ascii=False)

    # Print summary
    for name, data in results.items():
        status = data.get("_connection", "UNKNOWN")
        print(f"\n  {name}: {status}")
        if status == "SUCCESS":
            print(f"    Hostname: {data.get('hostname', 'N/A')}")
            print(f"    OS: {data.get('os_release', 'N/A')[:80]}")
            print(f"    CPUs: {data.get('cpu_count', 'N/A')}")
            print(f"    RAM: {data.get('memory', 'N/A')[:80]}")
            print(f"    Kernel: {data.get('kernel', 'N/A')}")

    print(f"\nRaw report saved to: {output_path}")
    print("Run this script again once SSH access is restored.")


if __name__ == "__main__":
    main()
