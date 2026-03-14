#!/usr/bin/env python3
"""Free disk space on production server."""
import sys
from ssh_config import ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


safe_print("=== Freeing disk space ===\n")

# Clean docker unused resources
cleanup_cmds = [
    ("Docker image prune", "docker image prune -f"),
    ("Docker builder prune", "docker builder prune -f"),
    ("Journal vacuum 100M", "journalctl --vacuum-size=100M"),
    ("Clean apt cache", "apt-get clean"),
    ("Remove old logs", "find /var/log -name '*.gz' -delete 2>/dev/null; find /var/log -name '*.1' -delete 2>/dev/null; echo done"),
    ("Clean /tmp tsx", "rm -rf /tmp/tsx-* /tmp/node-compile-cache"),
    ("Disk usage after", "df -h /"),
]

for label, cmd in cleanup_cmds:
    code, out, err = ssh(VM_APP, cmd, timeout=120)
    safe_print(f"{label}: exit {code}")
    if out:
        for line in out.splitlines()[:5]:
            safe_print(f"  {line}")

safe_print("\nDone!")
