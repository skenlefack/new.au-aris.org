#!/usr/bin/env python3
"""Check /tmp space and container names on production."""
import sys
from ssh_config import ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


cmds = [
    "df -h /tmp",
    "du -sh /tmp/tsx-* 2>/dev/null || echo 'no tsx dirs'",
    "ls -la /tmp/ | head -30",
    "docker ps --format '{{.Names}}' | sort",
]

for cmd in cmds:
    code, out, err = ssh(VM_APP, cmd, timeout=15)
    safe_print(f"\n=== {cmd} ===")
    safe_print(f"  {out.strip()}")
    if err:
        safe_print(f"  ERR: {err}")
