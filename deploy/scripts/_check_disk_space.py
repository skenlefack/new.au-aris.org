#!/usr/bin/env python3
"""
ARIS — Check disk space on all 4 production VMs
"""

import paramiko
import sys
from datetime import datetime

VMS = [
    {"name": "VM-APP",   "hostname": "nbo-aris04", "ip": "10.202.101.183", "role": "Services, Traefik, Frontend, BI"},
    {"name": "VM-KAFKA", "hostname": "nbo-brk01",  "ip": "10.202.101.184", "role": "Kafka KRaft x3, Schema Registry"},
    {"name": "VM-DB",    "hostname": "nbo-dbms03", "ip": "10.202.101.185", "role": "PostgreSQL 16 + PgBouncer"},
    {"name": "VM-CACHE", "hostname": "nbo-cch01",  "ip": "10.202.101.186", "role": "Redis 7 + OpenSearch 2.17"},
]

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

COMMANDS = [
    ("Disk usage (all mounts)", "df -h --output=source,fstype,size,used,avail,pcent,target -x tmpfs -x devtmpfs -x squashfs 2>/dev/null || df -h"),
    ("Largest directories (top 10)", "sudo -S du -h --max-depth=1 / 2>/dev/null | sort -rh | head -15"),
    ("Docker disk usage", "sudo -S docker system df 2>/dev/null || echo 'No Docker'"),
    ("Inodes usage", "df -ih --output=source,itotal,iused,iavail,ipcent,target -x tmpfs -x devtmpfs -x squashfs 2>/dev/null || df -ih"),
]


def run_cmd(client, cmd, password, timeout=30):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    if "sudo -S" in cmd:
        stdin.write(password + "\n")
        stdin.flush()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err_lines = [l for l in err.split("\n") if "[sudo]" not in l and "password for" not in l.lower()]
    err = "\n".join(err_lines).strip()
    return out, err


def main():
    print(f"{'#'*80}")
    print(f"  ARIS — Disk Space Report — All Production VMs")
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'#'*80}")

    for vm in VMS:
        print(f"\n{'='*80}")
        print(f"  {vm['name']} — {vm['hostname']} ({vm['ip']})")
        print(f"  Role: {vm['role']}")
        print(f"{'='*80}")

        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        try:
            client.connect(
                hostname=vm["ip"],
                username=SSH_USER,
                password=SSH_PASS,
                timeout=10,
            )

            for title, cmd in COMMANDS:
                print(f"\n  --- {title} ---")
                out, err = run_cmd(client, cmd, SSH_PASS, timeout=60)
                if out:
                    for line in out.split("\n"):
                        print(f"  {line}")
                if err and len(err) > 5:
                    print(f"  [STDERR] {err[:200]}")

        except Exception as e:
            print(f"  [!] Connection failed: {e}")
        finally:
            client.close()

    print(f"\n{'#'*80}")
    print(f"  Report complete — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'#'*80}")


if __name__ == "__main__":
    main()
