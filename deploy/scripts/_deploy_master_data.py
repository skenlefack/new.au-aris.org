#!/usr/bin/env python3
"""Deploy master-data service to production + staging (PAID_ADMIN role fix)."""
import time
from ssh_config import ssh, step, VM_APP

VM_APP_STG = "10.202.101.146"
DEPLOY_DIR_PROD = "/opt/aris-deploy/vm-app"
DEPLOY_DIR_STG = "/opt/aris-deploy/vm-app-stg"

# ── Step 1: Pull latest code on both VMs ──
step("Step 1: Pull latest code")
for label, host in [("PROD", VM_APP), ("STAGING", VM_APP_STG)]:
    code, out, _ = ssh(host, "cd /opt/aris && git fetch origin && git reset --hard origin/main 2>&1", timeout=60)
    lines = out.strip().splitlines()
    for l in lines[-3:]:
        print(f"  [{label}] {l.strip()}")

# ── Step 2: Rebuild master-data on PROD ──
step("Step 2: Rebuild master-data on PROD")
code, out, _ = ssh(
    VM_APP,
    f"cd {DEPLOY_DIR_PROD} && docker compose up -d --build --no-deps master-data 2>&1",
    timeout=600)
print(out[-500:] if len(out) > 500 else out)
print(f"  Exit: {code}")

# ── Step 3: Rebuild master-data on STAGING ──
step("Step 3: Rebuild master-data on STAGING")
code, out, _ = ssh(
    VM_APP_STG,
    f"cd {DEPLOY_DIR_STG} && docker compose up -d --build --no-deps master-data 2>&1",
    timeout=600)
print(out[-500:] if len(out) > 500 else out)
print(f"  Exit: {code}")

# ── Step 4: Verify health ──
step("Step 4: Verify health")
time.sleep(8)
for label, host in [("PROD", VM_APP), ("STAGING", VM_APP_STG)]:
    code, out, _ = ssh(host, "curl -s -o /dev/null -w '%{http_code}' http://localhost:3003/health 2>&1")
    status = out.strip()
    icon = "OK" if status in ("200", "204") else "WARN"
    print(f"  [{label}] master-data (:3003) => {status} [{icon}]")

# ── Step 5: Docker cleanup ──
step("Step 5: Docker cleanup")
for label, host in [("PROD", VM_APP), ("STAGING", VM_APP_STG)]:
    code, out, _ = ssh(host, "docker image prune -f 2>&1", timeout=60)
    reclaimed = [l for l in out.splitlines() if "reclaimed" in l.lower()]
    for line in reclaimed:
        print(f"  [{label}] {line.strip()}")

print("\n" + "=" * 60)
print("  MASTER-DATA DEPLOYED (PROD + STAGING)!")
print("  PAID_ADMIN can now manage PAID reference data.")
print("=" * 60)
