#!/usr/bin/env python3
"""
ARIS Security Investigation — Part 3 (sudo Docker checks)
Pipes password via stdin for sudo -S
"""

import paramiko
import sys
from datetime import datetime

VM_APP = {
    "ip": "10.202.101.183",
    "user": "arisadmin",
    "password": "@u-1baR.0rg$U24",
}

SUDO_COMMANDS = [
    ("D1 — Running containers",
     "sudo -S docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}'"),

    ("D2 — Search nmap binary in ALL containers",
     "sudo -S docker ps -q | while read cid; do cname=$(sudo -S docker inspect --format '{{.Name}}' $cid 2>/dev/null); r=$(sudo -S docker exec $cid sh -c 'which nmap 2>/dev/null; find / -maxdepth 3 -name nmap -type f 2>/dev/null' 2>/dev/null); if [ -n \"$r\" ]; then echo \"*** FOUND in $cname: $r\"; fi; done; echo 'Scan complete'"),

    ("D3 — Search nmap in Docker overlay2 (image layers)",
     "sudo -S find /var/lib/docker/overlay2 -name 'nmap' -type f 2>/dev/null | head -20; echo 'Overlay scan complete'"),

    ("D4 — Search nmap string in Docker overlay2 (broader)",
     "sudo -S find /var/lib/docker -iname '*nmap*' 2>/dev/null | head -20; echo 'Docker fs scan complete'"),

    ("D5 — Grep nmap in Veeam temp executables",
     "sudo -S find /tmp -name 'VeeamApp_*' -type f 2>/dev/null | head -10; echo 'Veeam temp check complete'"),

    ("D6 — Check dmesg for scan activity",
     "sudo -S dmesg | grep -i -E 'nmap|scan|SYN.flood' | tail -20; echo 'dmesg check complete'"),

    ("D7 — iptables rules",
     "sudo -S iptables -L -n 2>/dev/null | head -40; echo 'iptables check complete'"),

    ("D8 — Check if arisadmin is in docker group",
     "groups arisadmin; id arisadmin"),
]


def run_sudo_command(client, cmd, password):
    """Run a command with sudo -S, piping password to stdin."""
    stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
    # Send password for sudo -S
    stdin.write(password + "\n")
    stdin.flush()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    # Filter out sudo password prompt from stderr
    err_lines = [l for l in err.split("\n") if "[sudo]" not in l and "password" not in l.lower()]
    err = "\n".join(err_lines).strip()
    return out, err


def main():
    print("=" * 80)
    print(f"  INVESTIGATION PART 3 — Sudo Docker + Deep Scan")
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

        for title, cmd in SUDO_COMMANDS:
            print("-" * 80)
            print(f"  [{title}]")
            print("-" * 80)
            try:
                out, err = run_sudo_command(client, cmd, VM_APP["password"])
                if out:
                    print(out)
                if err:
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
        print("  Part 3 complete.")
        print("=" * 80)


if __name__ == "__main__":
    main()
