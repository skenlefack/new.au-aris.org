#!/usr/bin/env python3
"""Restart the frontend container."""
import paramiko
import sys
import os
import time

os.environ["PYTHONIOENCODING"] = "utf-8"

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
HOST = "10.202.101.183"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, SSH_USER, SSH_PASS, timeout=15,
              allow_agent=False, look_for_keys=False)
    return c


def run_sudo(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out


c = get_client()

# 1. Restart frontend
safe_print("=== Restarting frontend (aris-web) ===")
code, out = run_sudo(c, "docker restart aris-web 2>&1")
safe_print(f"  Restart: {out}")
c.close()

safe_print("  Waiting 15s for Next.js to start...")
time.sleep(15)

# 2. Verify it's back up
c = get_client()
code, out = run_sudo(c, "docker ps --filter name=aris-web --format '{{.Names}}: {{.Status}}' 2>/dev/null")
safe_print(f"  Status: {out}")

# 3. Check frontend is serving
code, out = run_sudo(c, "curl -s -o /dev/null -w '%{http_code}' http://localhost:3100 2>&1")
safe_print(f"  Port 3100: {out}")

code, out = run_sudo(c, "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/ 2>&1")
safe_print(f"  Port 80 (Traefik): {out}")

# 4. Also check that form-builder API returns templates via gateway
safe_print("\n=== Checking form-builder API via Traefik ===")
code, out = run_sudo(c, """curl -s http://localhost:80/api/v1/form-builder/templates 2>&1 | head -c 300""")
safe_print(f"  /api/v1/form-builder/templates: {out[:300]}")

# 5. Also restart form-builder service just in case
safe_print("\n=== Restarting form-builder ===")
code, out = run_sudo(c, "docker restart aris-form-builder 2>&1")
safe_print(f"  Restart: {out}")

c.close()

safe_print("\n  Fait! Rafraichissez votre navigateur (Ctrl+Shift+R pour un hard refresh).")
safe_print("=== Done ===")
