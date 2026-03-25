#!/usr/bin/env python3
"""
ARIS Security Investigation — Part 2 (Docker + deep scan)
Requires sudo for Docker socket access
"""

import paramiko
import sys
from datetime import datetime

VM_APP = {
    "ip": "10.202.101.183",
    "user": "arisadmin",
    "password": "@u-1baR.0rg$U24",
}

COMMANDS = [
    # ── Docker container scan for nmap (with sudo) ──
    ("D1 — List all running containers",
     "sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' 2>/dev/null | head -50"),

    ("D2 — Search nmap in ALL container filesystems",
     "sudo docker ps --format '{{.Names}}' | while read c; do r=$(sudo docker exec \"$c\" sh -c 'which nmap 2>/dev/null || find / -name nmap -maxdepth 4 2>/dev/null' 2>/dev/null); if [ -n \"$r\" ]; then echo \"*** FOUND in $c: $r\"; fi; done; echo 'Docker nmap scan complete'"),

    ("D3 — Search nmap in container package lists",
     "sudo docker ps --format '{{.Names}}' | while read c; do r=$(sudo docker exec \"$c\" sh -c 'dpkg -l 2>/dev/null | grep -i nmap; rpm -qa 2>/dev/null | grep -i nmap; apk list --installed 2>/dev/null | grep -i nmap' 2>/dev/null); if [ -n \"$r\" ]; then echo \"*** FOUND in $c: $r\"; fi; done; echo 'Container package scan complete'"),

    ("D4 — Check Docker image layers for nmap references",
     "sudo docker images --format '{{.Repository}}:{{.Tag}}' | head -20 | while read img; do r=$(sudo docker history \"$img\" 2>/dev/null | grep -i nmap); if [ -n \"$r\" ]; then echo \"*** FOUND in image $img: $r\"; fi; done; echo 'Image history scan complete'"),

    # ── Veeam agent investigation ──
    ("V1 — Veeam agent files on system",
     "find / -iname '*veeam*' -type f 2>/dev/null | head -30 || echo 'No Veeam files found'"),

    ("V2 — OracleAgent.log contents (tail)",
     "tail -50 /tmp/OracleAgent.log 2>/dev/null || echo 'File not found'"),

    ("V3 — PostgresAgent.log contents (tail)",
     "tail -50 /tmp/PostgresAgent.log 2>/dev/null || echo 'File not found'"),

    # ── Deep filesystem scan for nmap ──
    ("F1 — Find ANY file containing 'nmap' in name",
     "sudo find / -iname '*nmap*' ! -path '*/proc/*' ! -path '*/sys/*' 2>/dev/null | head -30 || echo 'No nmap-related files'"),

    ("F2 — Search for nmap in Docker overlay filesystems",
     "sudo find /var/lib/docker/overlay2 -name 'nmap' -type f 2>/dev/null | head -20 || echo 'No nmap in Docker overlays'"),

    ("F3 — Search nmap references in recently modified logs",
     "sudo grep -rl 'nmap' /var/log/ 2>/dev/null | head -10 || echo 'No nmap references in /var/log'"),

    # ── Network scan detection ──
    ("N1 — Check for recent port scans in kernel log",
     "sudo dmesg | grep -i -E 'scan|nmap|SYN' | tail -20 2>/dev/null || echo 'No scan traces in dmesg'"),

    ("N2 — iptables/nftables rules (firewall status)",
     "sudo iptables -L -n 2>/dev/null | head -30 || sudo nft list ruleset 2>/dev/null | head -30 || echo 'No firewall rules found'"),

    ("N3 — UFW status",
     "sudo ufw status verbose 2>/dev/null || echo 'UFW not active'"),

    # ── Identify IP 10.202.101.20 (frequent SSH source) ──
    ("I1 — Reverse DNS for 10.202.101.20",
     "host 10.202.101.20 2>/dev/null || nslookup 10.202.101.20 2>/dev/null || echo 'No reverse DNS'"),

    # ── Check if Veeam agent runs nmap-like scans ──
    ("V4 — Running Veeam processes",
     "ps aux | grep -i veeam | grep -v grep || echo 'No Veeam processes running'"),

    ("V5 — Veeam systemd services",
     "systemctl list-units --all 2>/dev/null | grep -i veeam || echo 'No Veeam services'"),
]


def main():
    print("=" * 80)
    print(f"  INVESTIGATION PART 2 — Docker + Deep Scan")
    print(f"  Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(
            hostname=VM_APP["ip"],
            username=VM_APP["user"],
            password=VM_APP["password"],
            timeout=15,
        )
        print("[+] Connected.\n")

        for title, cmd in COMMANDS:
            print("-" * 80)
            print(f"  [{title}]")
            print("-" * 80)
            try:
                stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
                out = stdout.read().decode("utf-8", errors="replace").strip()
                err = stderr.read().decode("utf-8", errors="replace").strip()
                if out:
                    print(out)
                if err and "WARNING" not in err and "dpkg" not in err:
                    print(f"  [STDERR] {err}")
                if not out and not err:
                    print("  (no output)")
            except Exception as e:
                print(f"  [ERROR] {e}")
            print()

    except Exception as e:
        print(f"[!] Connection error: {e}")
        sys.exit(1)
    finally:
        client.close()
        print("=" * 80)
        print("  Part 2 complete.")
        print("=" * 80)


if __name__ == "__main__":
    main()
