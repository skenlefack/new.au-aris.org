#!/usr/bin/env python3
"""Check web container status and rebuild if needed."""
import time
from ssh_config import ssh, VM_APP

# Check status
print("Current web container status:")
code, out, err = ssh(VM_APP, "docker ps --filter name=aris-web --format '{{.Status}} {{.Image}}'")
print(f"  {out.strip()}")

# Rebuild
print("\nRebuilding web container...")
code, out, err = ssh(VM_APP, "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml build web", timeout=600)
# Only print last 20 lines
lines = out.strip().split('\n')
for line in lines[-20:]:
    print(f"  {line}")

print("\nRestarting web container...")
code, out, err = ssh(VM_APP, "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml up -d web", timeout=60)
print(f"  {out.strip()}")

time.sleep(3)
print("\nNew status:")
code, out, err = ssh(VM_APP, "docker ps --filter name=aris-web --format '{{.Status}}'")
print(f"  {out.strip()}")

print("\nDone!")
