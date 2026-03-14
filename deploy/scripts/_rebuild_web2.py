#!/usr/bin/env python3
"""Pull + rebuild + restart web container."""
import time
from ssh_config import ssh, VM_APP

print("1. git pull...")
_, out, _ = ssh(VM_APP, "cd /opt/aris && git pull origin main")
print(f"   {out}")

print("2. cp compose...")
ssh(VM_APP, "cp /opt/aris/deploy/vm-app/docker-compose.yml /opt/aris-deploy/vm-app/docker-compose.yml")

print("3. Rebuild web (--no-cache)...")
_, out, _ = ssh(VM_APP, "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml build --no-cache web", timeout=900)
for line in out.split('\n')[-5:]:
    print(f"   {line}")

print("4. Restart web...")
ssh(VM_APP, "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml up -d web", timeout=60)
time.sleep(5)
_, out, _ = ssh(VM_APP, "docker ps --filter name=aris-web --format '{{.Status}}'")
print(f"   Status: {out}")

print("Done!")
