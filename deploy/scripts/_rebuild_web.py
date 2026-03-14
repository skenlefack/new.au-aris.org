#!/usr/bin/env python3
"""Force rebuild web container with --no-cache."""
import time
from ssh_config import ssh, VM_APP

print("Force rebuilding web container (--no-cache, may take 5-10 min)...")
_, out, _ = ssh(VM_APP, "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml build --no-cache web", timeout=900)
lines = out.split('\n')
for line in lines[-30:]:
    print(f"  {line}")

print("\nRestarting web container...")
_, out, _ = ssh(VM_APP, "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml up -d web", timeout=60)
print(f"  {out}")

time.sleep(5)
print("\nNew status:")
_, out, _ = ssh(VM_APP, "docker ps --filter name=aris-web --format '{{.Status}}'")
print(f"  {out}")

print("\nDone!")
