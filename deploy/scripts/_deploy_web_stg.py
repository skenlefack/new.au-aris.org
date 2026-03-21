#!/usr/bin/env python3
"""
Deploy web frontend changes to staging (test.au-aris.org).

Usage:
  export ARIS_VM_APP=10.202.101.146
  export ARIS_DEPLOY_PASS='...'
  python _deploy_web_stg.py
"""
import time
from ssh_config import ssh, step, VM_APP

print("=" * 60)
print("  ARIS STAGING — Web Frontend Deploy")
print(f"  Target: {VM_APP}")
print("=" * 60)

# Step 1: Pull latest code
step("Step 1: Pull latest code on VM-APP-STG")
code, out, _ = ssh(VM_APP, "cd /opt/aris && git pull origin main 2>&1", timeout=60)
print(out)

# Step 2: Rebuild and restart web container
step("Step 2: Rebuild and restart web container (staging)")
code, out, _ = ssh(
    VM_APP,
    "cd /opt/aris-deploy/vm-app-stg && docker compose --env-file .env up -d --build --no-deps web 2>&1",
    timeout=600
)
print(out)
print(f"  Exit: {code}")

# Step 3: Wait and verify
step("Step 3: Verify")
time.sleep(5)
code, out, _ = ssh(VM_APP, "curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/ 2>&1")
print(f"  http://localhost:3100/ => {out.strip()}")

# Step 4: Cleanup old images and build cache
step("Step 4: Docker cleanup")
code, out, _ = ssh(VM_APP, "docker image prune -f && docker builder prune -f --keep-storage=2GB 2>&1", timeout=120)
reclaimed = [l for l in out.splitlines() if "reclaimed" in l.lower()]
for line in reclaimed:
    print(f"  {line.strip()}")
code, out, _ = ssh(VM_APP, "df -h / | tail -1")
print(f"  Disk: {out.strip()}")

print("\n" + "=" * 60)
print("  STAGING WEB DEPLOYED!")
print(f"  URL: https://test.au-aris.org/")
print("=" * 60)
