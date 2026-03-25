#!/usr/bin/env python3
"""
ARIS Security Investigation — nmap IoC on nbo-aris04
Triggered by Veeam Backup malware detection alert 2026-03-24
"""

import paramiko
import sys
from datetime import datetime

VM_APP = {
    "hostname": "nbo-aris04",
    "ip": "10.202.101.183",
    "user": "arisadmin",
    "password": "@u-1baR.0rg$U24",
}

INVESTIGATION_COMMANDS = [
    # ── Section 1: nmap presence ──
    ("1.1 — nmap binary location", "which nmap 2>/dev/null || echo 'nmap NOT found in PATH'"),
    ("1.2 — nmap package installed (dpkg)", "dpkg -l 2>/dev/null | grep -i nmap || echo 'No nmap package found via dpkg'"),
    ("1.3 — nmap package installed (apt)", "apt list --installed 2>/dev/null | grep -i nmap || echo 'No nmap package found via apt'"),
    ("1.4 — Find nmap binaries anywhere on disk", "find / -name 'nmap' -o -name 'nmap.exe' 2>/dev/null | head -20 || echo 'No nmap binary found'"),
    ("1.5 — nmap version (if installed)", "nmap --version 2>/dev/null || echo 'nmap not executable'"),

    # ── Section 2: Installation history ──
    ("2.1 — apt history (nmap)", "zgrep -i nmap /var/log/apt/history.log* 2>/dev/null || echo 'No nmap in apt history'"),
    ("2.2 — dpkg log (nmap)", "zgrep -i nmap /var/log/dpkg.log* 2>/dev/null || echo 'No nmap in dpkg log'"),

    # ── Section 3: Execution history ──
    ("3.1 — bash_history arisadmin (nmap)", "grep -i nmap /home/arisadmin/.bash_history 2>/dev/null || echo 'No nmap in arisadmin history'"),
    ("3.2 — bash_history root (nmap)", "sudo grep -i nmap /root/.bash_history 2>/dev/null || echo 'No nmap in root history'"),
    ("3.3 — All user histories (nmap)", "for f in /home/*/.bash_history; do echo \"=== $f ===\"; grep -i nmap \"$f\" 2>/dev/null; done || echo 'No matches'"),

    # ── Section 4: nmap inside Docker containers ──
    ("4.1 — nmap in running containers", "docker ps --format '{{.Names}}' | while read c; do r=$(docker exec \"$c\" which nmap 2>/dev/null); if [ -n \"$r\" ]; then echo \"FOUND in container $c: $r\"; fi; done; echo 'Container scan complete'"),
    ("4.2 — nmap packages in containers", "docker ps --format '{{.Names}}' | while read c; do r=$(docker exec \"$c\" sh -c 'dpkg -l 2>/dev/null | grep nmap' 2>/dev/null); if [ -n \"$r\" ]; then echo \"FOUND in container $c: $r\"; fi; done; echo 'Container package scan complete'"),

    # ── Section 5: SSH access audit ──
    ("5.1 — Successful SSH logins (last 7 days)", "journalctl -u sshd --since '7 days ago' 2>/dev/null | grep -i 'accepted' | tail -30 || grep -i 'accepted' /var/log/auth.log 2>/dev/null | tail -30 || echo 'No SSH logs found'"),
    ("5.2 — Failed SSH attempts (last 7 days)", "journalctl -u sshd --since '7 days ago' 2>/dev/null | grep -i 'failed' | tail -30 || grep -i 'failed' /var/log/auth.log 2>/dev/null | tail -30 || echo 'No failed SSH logs found'"),
    ("5.3 — Last logins", "last -a | head -30"),
    ("5.4 — Currently logged in users", "who -a 2>/dev/null || w"),

    # ── Section 6: Network state ──
    ("6.1 — Listening ports", "ss -tulnp 2>/dev/null || netstat -tulnp 2>/dev/null"),
    ("6.2 — Established connections (non-Docker)", "ss -tnp state established 2>/dev/null | grep -v 'docker' | head -40"),
    ("6.3 — Unusual outbound connections", "ss -tnp state established 2>/dev/null | awk '{print $5}' | sort | uniq -c | sort -rn | head -20"),

    # ── Section 7: Suspicious processes ──
    ("7.1 — Processes by non-root non-system users", "ps aux | awk '$1 !~ /^(root|daemon|systemd|message|syslog|www-data|nobody|_apt|postgres|redis|1001)/' | head -30"),
    ("7.2 — Processes with network activity", "ss -tnp 2>/dev/null | awk '{print $6}' | sort -u | head -30"),

    # ── Section 8: Recent file modifications (suspicious paths) ──
    ("8.1 — Recently modified files in /tmp (last 7 days)", "find /tmp -type f -mtime -7 -ls 2>/dev/null | head -30 || echo 'Nothing in /tmp'"),
    ("8.2 — Recently modified files in /var/tmp", "find /var/tmp -type f -mtime -7 -ls 2>/dev/null | head -30 || echo 'Nothing in /var/tmp'"),
    ("8.3 — Recently modified files in /opt/aris (non-git, last 3 days)", "find /opt/aris -type f -mtime -3 ! -path '*/.git/*' ! -path '*/node_modules/*' -ls 2>/dev/null | head -30 || echo 'Nothing recent'"),
    ("8.4 — Setuid binaries (potential privilege escalation)", "find / -perm -4000 -type f 2>/dev/null | head -30"),

    # ── Section 9: Crontabs and scheduled tasks ──
    ("9.1 — System crontab", "cat /etc/crontab 2>/dev/null"),
    ("9.2 — User crontabs", "for u in $(cut -d: -f1 /etc/passwd); do c=$(sudo crontab -u \"$u\" -l 2>/dev/null); if [ -n \"$c\" ]; then echo \"=== $u ===\"; echo \"$c\"; fi; done"),
    ("9.3 — Cron directories", "ls -la /etc/cron.d/ /etc/cron.daily/ /etc/cron.hourly/ 2>/dev/null"),
    ("9.4 — Systemd timers", "systemctl list-timers --all 2>/dev/null | head -20"),

    # ── Section 10: Docker security ──
    ("10.1 — Docker containers running as root", "docker ps --format '{{.Names}}' | while read c; do u=$(docker exec \"$c\" whoami 2>/dev/null); echo \"$c: $u\"; done"),
    ("10.2 — Docker containers with host network", "docker ps --format '{{.Names}} {{.Ports}}' | head -40"),
    ("10.3 — Docker exposed ports (Traefik entrypoints)", "docker inspect aris-traefik 2>/dev/null | grep -A5 'PortBindings' | head -20 || echo 'Traefik not found'"),
]


def main():
    print("=" * 80)
    print(f"  ARIS SECURITY INVESTIGATION — {VM_APP['hostname']} ({VM_APP['ip']})")
    print(f"  Timestamp: {datetime.now().isoformat()}")
    print(f"  Reason: Veeam IoC alert — nmap (TA0007 Discovery)")
    print("=" * 80)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        print(f"\n[*] Connecting to {VM_APP['ip']}...")
        client.connect(
            hostname=VM_APP["ip"],
            username=VM_APP["user"],
            password=VM_APP["password"],
            timeout=15,
        )
        print("[+] Connected successfully.\n")

        for title, cmd in INVESTIGATION_COMMANDS:
            print("-" * 80)
            print(f"  [{title}]")
            print(f"  CMD: {cmd}")
            print("-" * 80)
            try:
                stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
                out = stdout.read().decode("utf-8", errors="replace").strip()
                err = stderr.read().decode("utf-8", errors="replace").strip()
                if out:
                    print(out)
                if err:
                    print(f"  [STDERR] {err}")
                if not out and not err:
                    print("  (no output)")
            except Exception as e:
                print(f"  [ERROR] {e}")
            print()

    except paramiko.AuthenticationException:
        print("[!] Authentication failed. Check credentials.")
        sys.exit(1)
    except paramiko.SSHException as e:
        print(f"[!] SSH error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[!] Connection error: {e}")
        sys.exit(1)
    finally:
        client.close()
        print("=" * 80)
        print("  Investigation complete.")
        print("=" * 80)


if __name__ == "__main__":
    main()
