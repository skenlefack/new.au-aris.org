#!/usr/bin/env python3
"""Debug web container structure."""
import sys
from ssh_config import ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


cmds = [
    "docker exec aris-web ls /app/ 2>&1",
    "docker exec aris-web ls /app/apps/web/ 2>&1 || echo 'NOT FOUND'",
    "docker exec aris-web ls /app/apps/ 2>&1 || echo 'NOT FOUND'",
    "docker exec aris-web pwd 2>&1",
    "docker exec aris-web which node 2>&1",
    "docker exec aris-web which npx 2>&1 || echo 'no npx'",
    "docker inspect aris-web --format '{{.Config.WorkingDir}}' 2>&1",
    "docker inspect aris-web --format '{{range .Config.Cmd}}{{.}} {{end}}' 2>&1",
    "docker inspect aris-web --format '{{.Config.Image}}' 2>&1",
]

for cmd in cmds:
    code, out, err = ssh(VM_APP, cmd, timeout=10)
    safe_print(f"\n=== {cmd.split('aris-web ')[-1][:60]} ===")
    safe_print(f"  {out}")
    if err:
        safe_print(f"  ERR: {err}")
