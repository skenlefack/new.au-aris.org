#!/usr/bin/env python3
"""
Seed staging database with initial data.

Runs seed scripts for all services that have them.
Uses the staging database via Docker exec on the staging containers.

Usage:
  export ARIS_VM_APP=10.202.101.146
  export ARIS_DEPLOY_PASS='...'
  python _seed_stg.py

  # Seed specific services only:
  python _seed_stg.py credential tenant
"""
import sys
import time
from ssh_config import ssh, step, VM_APP

# Services that have seed scripts (order matters: tenant first, then credential)
SEED_SERVICES = [
    "tenant",
    "credential",
    "master-data",
    "animal-health",
]

# Allow overriding via CLI args
if len(sys.argv) > 1:
    target_services = sys.argv[1:]
else:
    target_services = SEED_SERVICES

print("=" * 60)
print("  ARIS STAGING — Database Seed")
print(f"  Target VM: {VM_APP}")
print(f"  Services: {', '.join(target_services)}")
print("=" * 60)

# Step 1: Verify containers are running
step("Step 1: Verify staging containers are running")
code, out, _ = ssh(
    VM_APP,
    "docker ps --format '{{.Names}}' | grep aris-stg | sort 2>&1",
    timeout=30
)
running = [l.strip() for l in out.splitlines() if l.strip()]
print(f"  Running containers: {len(running)}")
for c in running[:10]:
    print(f"    {c}")
if len(running) > 10:
    print(f"    ... and {len(running) - 10} more")

if not running:
    print("\n  ERROR: No staging containers running!")
    print("  Deploy first: cd /opt/aris-deploy/vm-app-stg && docker compose --env-file .env up -d")
    sys.exit(1)

# Step 2: Run Prisma migrations
step("Step 2: Run Prisma migrations (via credential container)")
code, out, _ = ssh(
    VM_APP,
    "docker exec aris-stg-credential npx prisma migrate deploy --schema=prisma 2>&1",
    timeout=120
)
print(out[:2000] if len(out) > 2000 else out)
print(f"  Exit: {code}")

# Step 3: Seed each service
for i, svc in enumerate(target_services, 1):
    container = f"aris-stg-{svc}"
    step(f"Step 3.{i}: Seed {svc} ({container})")

    # Check if container exists
    code, out, _ = ssh(
        VM_APP,
        f"docker ps --filter name={container} --format '{{{{.Names}}}}' 2>&1",
        timeout=10
    )
    if container not in out:
        print(f"  SKIP: Container {container} not running")
        continue

    # Run the seed
    code, out, _ = ssh(
        VM_APP,
        f"docker exec {container} npx tsx src/seed.ts 2>&1",
        timeout=180
    )
    print(out[:3000] if len(out) > 3000 else out)
    status = "OK" if code == 0 else "FAILED"
    print(f"  Exit: {code} [{status}]")

    if code != 0:
        print(f"  WARNING: Seed for {svc} failed (exit {code})")

# Step 4: Verify seeded data
step("Step 4: Verify seeded data")
code, out, _ = ssh(
    VM_APP,
    "docker exec aris-stg-credential "
    "npx tsx -e \"const { PrismaClient } = require('@prisma/client'); "
    "const p = new PrismaClient(); "
    "p.user.count().then(c => { console.log('Users:', c); p.\\$disconnect(); })\" 2>&1",
    timeout=30
)
print(f"  {out.strip()}" if out.strip() else "  (could not verify user count)")

print("\n" + "=" * 60)
print("  STAGING SEED COMPLETE!")
print("  Login: admin@au-aris.org / Aris2024!")
print("  URL:   https://test.au-aris.org/")
print("  Email: http://10.202.101.146:8025 (Mailpit)")
print("=" * 60)
