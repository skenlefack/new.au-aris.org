#!/usr/bin/env python3
"""Deploy web frontend fix for notification preferences."""
import time
from ssh_config import get_client, VM_APP, VM_PASS

def ssh_exec(client, cmd, timeout=300):
    full_cmd = f"echo '{VM_PASS}' | sudo -S {cmd}" if cmd.startswith('docker') else cmd
    stdin, stdout, stderr = client.exec_command(full_cmd, timeout=timeout)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    out_lines = [l for l in out.split('\n') if not l.startswith('[sudo]')]
    err_lines = [l for l in err.split('\n') if not l.startswith('[sudo]')]
    return '\n'.join(out_lines), '\n'.join(err_lines)

c = get_client(VM_APP)

# Step 1: Pull
print("Step 1: git pull...")
out, err = ssh_exec(c, "cd /opt/aris && git pull origin main")
print(f"  {out}")

# Step 2: Copy compose
print("\nStep 2: Copying compose...")
ssh_exec(c, "cp /opt/aris/deploy/vm-app/docker-compose.yml /opt/aris-deploy/vm-app/docker-compose.yml")
print("  Done")

# Step 3: Rebuild and restart web
print("\nStep 3: Rebuilding web container (this takes a few minutes)...")
out, err = ssh_exec(c, "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml up -d --build web", timeout=600)
print(f"  {out}")
if err: print(f"  {err}")

# Step 4: Verify
print("\nStep 4: Checking web container...")
time.sleep(5)
out, err = ssh_exec(c, "docker ps --filter name=aris-web --format '{{.Status}}'")
print(f"  Status: {out}")

c.close()
print("\nDone!")
