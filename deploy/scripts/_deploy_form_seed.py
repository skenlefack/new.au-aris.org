#!/usr/bin/env python3
"""Deploy form-builder seed update: pull, rebuild, re-seed 21 templates."""
import sys
import time
from ssh_config import ssh, ssh_stream, step, VM_APP, VM_DB

DB_URL = "postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris"


# Step 1: Pull latest code
step("Step 1: Pull latest code on VM-APP")
code, out, _ = ssh(VM_APP, "cd /opt/aris && git pull origin main 2>&1", timeout=60)
print(out)
if code != 0:
    print(f"  WARN: git pull exit {code}")

# Step 2: Rebuild form-builder container
step("Step 2: Rebuild form-builder container")
code, out, _ = ssh(VM_APP,
    "cd /opt/aris-deploy/vm-app && docker compose up -d --build --no-deps form-builder 2>&1",
    timeout=600)
print(out)
print(f"  Exit: {code}")
if code != 0:
    print("  ERROR: rebuild failed")
    sys.exit(1)

# Step 3: Wait for container to start
step("Step 3: Wait for container health")
time.sleep(10)
code, out, _ = ssh(VM_APP, "curl -s -o /dev/null -w '%{http_code}' http://localhost:3010/health 2>&1")
status = out.strip()
icon = "OK" if status in ("200", "204") else "WARN"
print(f"  form-builder (:3010) => {status} [{icon}]")

# Step 4: Run form-builder seed
step("Step 4: Run form-builder seed (update 21 templates)")
code, _, _ = ssh_stream(VM_APP,
    f'docker exec -e DATABASE_URL="{DB_URL}" aris-form-builder sh -c "cd /app/services/form-builder && npx tsx src/seed.ts 2>&1"',
    timeout=120)
print(f"\n  Seed exit: {code}")
if code != 0:
    print("  ERROR: seed failed")
    sys.exit(1)

# Step 5: Verify templates in DB
step("Step 5: Verify form templates")
code, out, _ = ssh(VM_DB,
    'docker exec aris-postgres psql -U aris -d aris -c '
    '"SELECT name, domain, status FROM form_builder.form_templates ORDER BY name" 2>&1')
print(out)

print(f"\n{'='*60}")
print("  FORM-BUILDER SEED DEPLOYED!")
print(f"{'='*60}")
