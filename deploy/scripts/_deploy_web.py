#!/usr/bin/env python3
"""Deploy web frontend changes to production."""
import time
from ssh_config import ssh, step, VM_APP

# Step 1: Pull latest code
step("Step 1: Pull latest code on VM-APP")
code, out, _ = ssh(VM_APP, "cd /opt/aris && git pull origin main 2>&1", timeout=60)
print(out)

# Step 2: Rebuild and restart web container
step("Step 2: Rebuild and restart web container")
code, out, _ = ssh(
    VM_APP,
    "cd /opt/aris-deploy/vm-app && docker compose up -d --build --no-deps web 2>&1",
    timeout=600
)
print(out)
print(f"  Exit: {code}")

# Step 3: Wait and verify
step("Step 3: Verify")
time.sleep(5)
code, out, _ = ssh(VM_APP, "curl -s -o /dev/null -w '%{http_code}' http://localhost/ 2>&1")
print(f"  http://localhost/ => {out.strip()}")

print("\n" + "=" * 60)
print("  WEB DEPLOYED!")
print("=" * 60)
